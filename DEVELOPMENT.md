# YouthDevs Vibe IDE — Developer Documentation

A browser-based collaborative IDE built on Next.js, Firebase, Monaco, and xterm.js.
Users sign in, create HTML or Next.js project workspaces, edit code collaboratively in
real time, run an AI "vibe coding" assistant against their files, get a live terminal
backed by an external sandbox, preview their app, and deploy to Vercel. There's also an
admin-facing "hackathon" mode for running a submission-based event.

## Contents

- [Quick start](#quick-start)
- [Architecture overview](#architecture-overview)
- [Directory layout](#directory-layout)
- [Routing](#routing)
- [API routes](#api-routes)
- [Core components](#core-components)
- [Firebase](#firebase)
- [Third-party integrations](#third-party-integrations)
- [Environment variables](#environment-variables)
- [Build/dev tooling notes](#builddev-tooling-notes)
- [Known quirks & cleanup opportunities](#known-quirks--cleanup-opportunities)

## Quick start

```bash
npm install
npm run dev      # next dev --webpack, http://localhost:3000
npm run build
npm run start
npm run lint
```

Copy `.env.local` (see [Environment variables](#environment-variables)) before running.
If `NEXT_PUBLIC_FIREBASE_API_KEY` is unset or left as the placeholder string, the app
boots in an **offline/demo mode**: `auth`/`db` stay `null` and the IDE falls back to an
in-memory mock project instead of talking to Firebase.

## Architecture overview

- **Framework**: Next.js App Router, mixed JS/TS (almost everything is `.js`; TypeScript
  support was added for a single now-removed API route — see
  [Known quirks](#known-quirks--cleanup-opportunities)).
- **Client state**: no Redux/Zustand — one very large client component
  ([`IdeShell.js`](src/components/ide/IdeShell.js)) owns essentially all state via
  `useState`/`useRef` and Firestore `onSnapshot` listeners.
- **Backend**: Firebase (Auth + Firestore) for data/auth, a handful of Next.js Route
  Handlers as thin server-side proxies to third-party APIs (Gemini, Vercel, SkipCourse),
  and an **external WebSocket sandbox/container backend** (not part of this repo) for
  terminal/code execution.
- **Editor**: Monaco, loaded from a CDN at runtime (not via the `@monaco-editor/react`
  package that's listed as a dependency).
- **Styling**: Tailwind, compiled locally *and* loaded again from the Tailwind CDN as a
  fallback in the root layout — see [Known quirks](#known-quirks--cleanup-opportunities).

## Directory layout

```
src/
  app/                                   Next.js App Router — pages + API routes
    page.js                              "/" marketing/landing page
    login/page.js                        "/login"
    workspace/page.js                    "/workspace"
    [project-slug]/page.js               "/:slug" — opens a project in the IDE
    admin/page.js                        "/admin" — hackathon control center
    admin/[project-slug]/page.js         "/admin/:slug" — read-only submission viewer
    dashboard/, dashborad/               redirect() -> /workspace (2nd is a legacy typo alias)
    api/                                 Route Handlers, see below
    layout.js                            Root layout (Tailwind CDN + xterm CSS)
  components/ide/                        All real UI/logic (see Core components)
  lib/ide-utils.js                       Small framework-agnostic helper functions
  utils/firebase.js                      Orphaned/unused duplicate Firebase init (do not use)
```

Notable quirk: the page files under `src/app/workspace/_components`,
`src/app/workspace/_utils`, and `src/app/login/_components` are mostly **re-export
shims**, e.g.:

```js
export { default } from '../../../components/ide/IdeShell';
```

The real component code lives under `src/components/ide/`, not `src/app/`. When making
changes, edit the components there — the `src/app/**/_components` files exist only to
satisfy the App Router's routing conventions.

One exception: `src/app/workspace/_utils/firebase.js` is the **real, canonical** Firebase
bootstrap module (not a shim) — see [Firebase](#firebase).

## Routing

| Route | Renders |
|---|---|
| `/` | Static landing page, links to `/login` and `/workspace` |
| `/login` | `AuthScreen` — email/password, Google, GitHub sign-in |
| `/workspace` | `IdeShell` in dashboard mode (project list) |
| `/[project-slug]` | `IdeShell` in IDE mode for that project |
| `/admin` | `IdeShell` in admin/hackathon-control-center mode |
| `/admin/[project-slug]` | `AdminSubmissionWorkspace` — read-only file viewer |
| `/dashboard`, `/dashborad` | Redirect to `/workspace` |

All redirect/auth-gating logic (unauthenticated → `/login?next=...`, `/admin*` gated
behind `canAccessAdminPanel`, invalid paths bounced to `/workspace`) is centralized in
[`src/components/ide/hooks/useRouteGuard.js`](src/components/ide/hooks/useRouteGuard.js).
Route parsing itself lives in `src/app/workspace/_utils/routes.js`
(`getWorkspaceRouteState()`), which computes a `routeMode` of
`root | login | workspace | project | admin | admin-project | invalid`.

## API routes

All under `src/app/api/`, all Next.js Route Handlers used to keep API keys server-side.

| Route | Method | Purpose |
|---|---|---|
| `/api/vibe` | POST | AI code-assistant. Calls Gemini (`GEMINI_API_KEY`) with the instruction + repo structure + context files, returns `{ chatResponse, filePatches }` that `IdeShell` applies to the in-memory file list. |
| `/api/deploy` | POST | Deploys workspace files to Vercel (`VERCEL_TOKEN`). Detects framework, creates/reuses a Vercel project, optionally provisions a `*.youthdevs.me` alias, creates the deployment. |
| `/api/preview-next` | POST | Writes workspace files to `.next-preview-workspace/` and spawns a real local `next dev --port 4173` child process for Next.js template live preview. Refuses to run on hosted/serverless runtimes (checks `process.env.VERCEL` / `AWS_LAMBDA_FUNCTION_NAME`) since it needs a long-lived child process. |
| `/api/skipcourse-submit` | POST | Legacy proxy that forwards code to `SKIPCOURSE_SUBMIT_URL`. Nothing in the current codebase calls this — dead code, superseded by an in-progress `/api/export/skipcourse` route that was reverted before landing (see [Known quirks](#known-quirks--cleanup-opportunities)). |

## Core components

All in `src/components/ide/`.

### `IdeShell.js` (~2,900 lines) — the orchestrator

The entire app shell post-auth. One giant client component that renders four different
views depending on auth/route state: an auth-loading gate, the dashboard (project list +
create-project form + admin hackathon control center), the IDE workspace (file explorer +
Monaco + AI chat + terminal, in a manually resizable split-pane layout), and the
read-only admin submission view (delegates to `AdminSubmissionWorkspace`).

Major responsibility groups:

- **Auth** — `onAuthStateChanged` listener; optional custom-token/anonymous bootstrap
  (`NEXT_PUBLIC_ENABLE_ANONYMOUS_AUTH`); GitHub OAuth popup flow.
- **Firestore sync** — live `onSnapshot` listeners on the user profile, global hackathon
  config, the user's projects (queried by `memberUids` and `memberEmails`, merged), the
  active project's `files` (auto `window.location.reload()` when a teammate's edit is
  newer — the collaboration mechanism), chat messages, and (admin-only) all hackathon
  projects + `adminSubmissions`.
- **Monaco lifecycle** — loads Monaco from a CDN via injected `<script>` + AMD
  `require()`, manually creates/disposes editor instances per file switch, preserves
  cursor/scroll `viewState` across remote content updates.
- **GitHub integration** — direct `api.github.com` REST calls from the client (repo
  creation, and a hand-rolled atomic commit pipeline: blob → tree → commit → ref update).
- **File sync/commit flow** — `syncFilesToWorkspace()` writes to Firestore and optionally
  GitHub; `ChangeCommitModal` prompts for a change description before manual edits
  (AI-driven edits sync directly, no prompt).
- **AI "vibe" pipeline** — `handleAgenticVibeSubmit()` posts to `/api/vibe`, applies
  `filePatches`, persists chat history, and enforces a "Supercharge" rate limit (10 uses
  per 10-minute cooldown, tracked on the user profile doc).
- **Preview** — inlines `<link>`/`<script>` refs into a single HTML blob for `html`-mode
  iframe preview, or calls `/api/preview-next` for `nextjs`-mode preview.
- **Deploy** — `handleDeployToVercel()` posts files to `/api/deploy`.
- **Hackathon/admin workflows** — mark a project as a hackathon submission, submit it
  (writes `submitted*` fields + mirrors to `adminSubmissions`), toggle global
  hackathon/submission/custom-domain flags.
- **Layout** — manual mouse-drag resize handlers (refs + global `mousemove`/`mouseup`)
  for the file explorer, editor, and chat/terminal split.
- **Theme** — dark/light, persisted to `localStorage('ide-theme')`.

Renders `WorkspaceHeader`, `Terminal`, `AdminSubmissionWorkspace`, `ChangeCommitModal`,
and `AdminSubmissionInspectorModal` as children.

### `WorkspaceHeader.js` — IDE top bar

Presentational (props in, callbacks out — no direct Firestore/Firebase calls). Shown only
in the IDE workspace view. Renders: back-to-dashboard button, project name (+ GitHub icon
if linked), team member list, color-coded "latest change" badge, teammate-invite form,
admin-only user counter, theme toggle, Supercharge button with cooldown countdown, signed-in
user's email, sign-out.

### `Terminal.js`

Wraps `xterm.js` + `xterm-addon-fit`, connected over a raw **WebSocket** to
`NEXT_PUBLIC_TERMINAL_WS_URL`. On connect, sends an `init` payload (project id/metadata +
full file list) so the remote backend can materialize a workspace/container. This is the
integration point for the external sandbox/execution backend — the backend itself is not
part of this repo, only the WS client. Handles reconnect, resize via `ResizeObserver`, and
a manual keydown → ANSI escape-sequence encoder for arrow keys/ctrl-chords.

### Other components

- **`admin/AdminSubmissionWorkspace.js`** — read-only file browser + code/preview tabs for
  inspecting a submitted team's files.
- **`hooks/useRouteGuard.js`** — see [Routing](#routing).
- **`modals/ChangeCommitModal.js`** — "describe this change" prompt before manual file
  add/remove/edit syncs (title becomes "Push GitHub Commit" for GitHub-linked projects).
- **`modals/AdminSubmissionInspectorModal.js`** — full-screen file browser/viewer used
  from the dashboard admin panel without navigating away.
- **`AuthScreen.js`** — real sign-in/sign-up UI (email/password, Google, GitHub).

### `src/lib/ide-utils.js`

- `DEMO_INDEX_HTML(title, subtitle)` — offline-demo HTML template generator.
- `decodeBase64Utf8(str)` — decodes GitHub Contents API base64 blobs to UTF-8.
- `filesAreIdentical(arr1, arr2)` — shallow compare to avoid redundant `setFiles()` calls.
- `buildVercelFilesPayload(workspaceFiles)` — maps files into Vercel's deploy API shape.
- `formatTime(secs)` — `mm:ss` formatter for the Supercharge cooldown.
- `slugifyProjectName(input)` — slug generator used for URLs, Vercel project names, and
  GitHub repo names.

There's no dedicated API-client module — each feature calls `fetch()` directly from
`IdeShell.js` or the relevant route handler.

## Firebase

Canonical config: [`src/app/workspace/_utils/firebase.js`](src/app/workspace/_utils/firebase.js).
Reads `NEXT_PUBLIC_FIREBASE_*` env vars; only calls `initializeApp` if `apiKey` is set and
isn't the placeholder `'placeholder-api-key-for-local-vibe'` (offline/demo mode
otherwise). Exports `auth`, `db`, `googleProvider`, `GithubAuthProvider`,
`GoogleAuthProvider`, and re-exported `firebase/auth` functions.

`src/utils/firebase.js` is an orphaned duplicate — see
[Known quirks](#known-quirks--cleanup-opportunities).

**Auth providers**: Google, GitHub (requests `repo` scope, used for the GitHub
integration), email/password, plus optional anonymous/custom-token auto sign-in gated by
`NEXT_PUBLIC_ENABLE_ANONYMOUS_AUTH`.

**Firestore collections** (see [firestore.rules](firestore.rules) for full rule logic):

- **`users/{uid}`** — profile: `email`, `superchargeUses`, `cooldownEndTime`, `isAdmin`.
  Readable by any authenticated user (needed for invite-by-email lookups and the admin
  user count). Self-writable except `email`/`isAdmin`.
- **`system/hackathon`** — single global doc `{ active, submissionsEnabled }`. Anyone can
  bootstrap-create it once; only admins can update after.
- **`projects/{projectId}`** — `name`, `slug`, `userId`, `memberUids[]`, `memberEmails[]`,
  `files[]`, `template`, `githubRepo`/`githubOwner`/`githubBranch`, `presence`,
  `lastChange{by,message,timestamp}`, `isHackathonProject`, `submitted*` fields.
  Membership is `memberUids` OR `memberEmails` match. Members can update files/presence
  but not `userId`/`slug`; a separate restricted path lets any member flip only the
  hackathon-submission fields; admins have full access.
- **`projects/{projectId}/chatMessages/{messageId}`** — AI chat history. Members can
  create well-shaped messages; only admins can update/delete.
- **`adminSubmissions/{projectId}`** — mirror doc created on hackathon submission, for the
  admin grading dashboard.

⚠️ **`isAuthenticated()` in `firestore.rules` is currently hard-coded to `return true;`**
— it does not check `request.auth != null`. There's a matching comment in `IdeShell.js`
(around line 291) acknowledging this and noting the client-side route gate is kept
consistent with that policy. Treat this as a known, intentional-for-now security posture,
not a bug to silently "fix" — but flag it before broadening this app's audience or trust
boundary.

## Third-party integrations

- **Monaco Editor** — loaded from `cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0` at
  runtime via a dynamically injected `<script>` tag + AMD `require()`, **not** via the
  `@monaco-editor/react` package (listed as a dependency but unused). Editor instances are
  created/disposed manually in a `useEffect` keyed on `[monacoLoaded, activeFileId, theme]`.
- **xterm.js** — see `Terminal.js` above. Dynamically `import()`ed client-side.
- **GitHub REST API** — called directly from the client using a token stored in
  `localStorage`; repo creation + atomic commit pipeline.
- **Vercel REST API** — server-side only, from `/api/deploy`.
- **Gemini API** — server-side only, from `/api/vibe`; model selection switches between
  e.g. `gemini-3.1-flash-lite` and `gemini-3.5-flash` based on Supercharge state.
- **External sandbox/execution backend** — not in this repo. `Terminal.js` is the WS
  client; the actual container/sandbox lives behind `NEXT_PUBLIC_TERMINAL_WS_URL`.

## Environment variables

Defined in `.env.local` (create your own locally; not committed):

```
GEMINI_API_KEY
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_MEASUREMENT_ID
VERCEL_TOKEN
NEXT_PUBLIC_TERMINAL_WS_URL
NEXT_PUBLIC_SKIPCOURSE_AUTH_BRIDGE_URL
```

Referenced in code but not currently set in `.env.local` (needed for those specific
features): `NEXT_PUBLIC_FORCE_ADMIN_PANEL`, `NEXT_PUBLIC_USE_CUSTOM_DOMAIN`,
`NEXT_PUBLIC_ENABLE_ANONYMOUS_AUTH`, `USE_CUSTOM_DOMAIN` (server-side, `/api/deploy`),
`SKIPCOURSE_SUBMIT_URL` (has a hardcoded default if unset).

## Build/dev tooling notes

- `npm run dev` runs `next dev --webpack` — **Turbopack is explicitly disabled** for dev
  even though `next.config.mjs` has an (empty) `turbopack: {}` block.
- `next.config.mjs` also disables webpack's persistent cache in dev (`config.cache =
  false`), with a comment explaining this works around OneDrive file-rename races
  corrupting `.next/cache` — relevant since this repo lives in an OneDrive-synced folder.
  It also aliases `@xterm/addon-fit` → `xterm-addon-fit`.
- No `output` mode is configured — standard Node server build. This matters because
  `/api/preview-next` needs a live Node process to spawn child processes; it won't work
  on a static export or most serverless platforms (and explicitly self-disables there).
- `tailwind.config.js` is Tailwind v3, scanning `src/pages`, `src/components`, `src/app`.
  Tailwind is **also** loaded from the CDN in `src/app/layout.js` as a documented
  fallback ("force directive" comment) — styling is effectively double-sourced.
- No path aliases in `tsconfig.json` — all internal imports are relative, including some
  fairly deep ones (e.g. `IdeShell.js` importing back up into
  `src/app/workspace/_utils/*`).
- `tsconfig.json` is new and minimal; it exists to support TypeScript route handlers.
  `allowJs: true`, `strict: false`. The codebase is effectively all JS today — treat any
  new `.ts` files as the start of an ongoing JS→TS migration, not an established pattern.

## Known quirks & cleanup opportunities

- **`src/utils/firebase.js` is dead code** — a near-duplicate, less complete version of
  `src/app/workspace/_utils/firebase.js` (missing GitHub provider, anon/custom-token
  auth; has stray debug `console.log`s). Nothing imports it. Safe to delete, or worth
  consolidating if you're touching Firebase init.
- **`src/app/api/skipcourse-submit/route.js` is unused** — nothing in the current
  codebase calls it. It was superseded by an `/api/export/skipcourse` route that was
  being built (server route + `src/lib/skipcourse.js` + two new modals +
  `IdeShell`/`WorkspaceHeader` wiring for a "Send to SkipCourse" export button) but that
  work was reverted from the working tree before landing. If you pick this feature back
  up, note it required `SKIPCOURSE_API_BASE`/`SKIPCOURSE_API_KEY` env vars that don't
  currently exist in `.env.local` (which instead has a differently-named
  `NEXT_PUBLIC_SKIPCOURSE_AUTH_BRIDGE_URL`) — reconcile that naming before wiring it up.
- **Firestore `isAuthenticated()` always returns `true`** — see
  [Firebase](#firebase) above. Don't "fix" this without understanding why it was set that
  way; it's referenced explicitly in `IdeShell.js` comments as intentional-for-now.
  Revisit before this app handles more sensitive data or a larger user base.
- **Double Tailwind sourcing** (compiled + CDN) and **Monaco loaded via CDN instead of the
  installed npm package** are both fragile-by-design choices (network dependency at
  runtime, version drift risk). Worth revisiting if offline/air-gapped use or stricter
  CSPs become a requirement.
- Stray log files (`build.err.log`, `next-dev.*.log`, `route-smoke.*.log`) and scratch
  directories (`.next-preview-spawn-test/`, `.next-preview-workspace/`) at the repo root
  are local artifacts from dev/preview runs — check `.gitignore` covers them before
  committing.
