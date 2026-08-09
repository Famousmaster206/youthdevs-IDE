import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Code2,
  Eye,
  FolderPlus,
  GitBranch,
  Keyboard,
  MessageSquare,
  Moon,
  Rocket,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';

const sections = [
  {
    id: 'getting-started',
    icon: FolderPlus,
    title: 'Getting started',
    intro: 'Everything happens from your workspace dashboard.',
    items: [
      {
        heading: 'Sign in',
        body: 'Sign in with Google, GitHub, or an email and password from the Sign in page. GitHub sign-in also asks for repo access, which is what powers the optional GitHub sync feature below.',
      },
      {
        heading: 'Create a project',
        body: 'From your workspace dashboard, choose "Create project" and pick a starter template — a plain HTML/CSS/JS site or a Next.js app. Give it a name; a URL-friendly slug is generated for you automatically.',
      },
      {
        heading: 'Open a project',
        body: 'Click any project card to open it in the IDE. The URL becomes your project\'s own address (e.g. yourapp.com/your-project-slug) — bookmark it or share it with teammates.',
      },
    ],
  },
  {
    id: 'editor',
    icon: Code2,
    title: 'The editor',
    intro: 'A full code editor in your browser, powered by Monaco (the same editor as VS Code).',
    items: [
      {
        heading: 'File explorer',
        body: 'The left panel lists every file in your project. Click a file to open it, or use the explorer\'s controls to add and remove files.',
      },
      {
        heading: 'Editing',
        body: 'Standard editor shortcuts, syntax highlighting, and multi-file editing all work as you\'d expect. Your changes save automatically and sync to your teammates in real time.',
      },
      {
        heading: 'Resizable layout',
        body: 'Drag the dividers between the file explorer, editor, and the chat/terminal footer to resize each panel to how you like to work.',
      },
      {
        heading: 'Describe your changes',
        body: 'When you add, remove, or otherwise commit a manual edit, you\'ll be asked to briefly describe the change. This keeps a readable history for your team (and becomes your GitHub commit message, if your project is linked to GitHub).',
      },
    ],
  },
  {
    id: 'ai-assistant',
    icon: Sparkles,
    title: 'AI assistant ("Vibe" chat)',
    intro: 'Describe what you want in plain language and let the assistant edit your files for you.',
    items: [
      {
        heading: 'How it works',
        body: 'Open the chat panel and type an instruction — e.g. "add a dark mode toggle" or "fix the bug where the form doesn\'t submit." The assistant reads your project\'s files and responds with a set of file changes, which are applied straight into your workspace.',
      },
      {
        heading: 'Review before you trust it',
        body: 'The assistant can create, update, or delete files. Always look over what changed afterward — treat it like a fast but occasionally wrong collaborator, not an oracle.',
      },
      {
        heading: 'Supercharge',
        body: 'Toggle Supercharge (in the top bar) to use a stronger model for trickier requests. Supercharge is rate-limited — after your uses run out you\'ll enter a 10-minute cooldown before you can use it again. A countdown timer shows how much time is left.',
      },
      {
        heading: 'Chat history',
        body: 'Your conversation with the assistant is saved per-project, so you and your teammates can scroll back through past requests and changes.',
      },
    ],
  },
  {
    id: 'terminal',
    icon: Terminal,
    title: 'Terminal',
    intro: 'A real, live terminal connected to your project — install packages, run scripts, and inspect output.',
    items: [
      {
        heading: 'Using it',
        body: 'Open the terminal panel at the bottom of the IDE. It behaves like a normal Linux shell, with your project\'s files already present. Run things like npm install or npm run dev directly.',
      },
      {
        heading: 'Reconnecting',
        body: 'If the terminal disconnects (e.g. after being idle, or a network hiccup), it will attempt to reconnect automatically. If it doesn\'t recover, refresh the page.',
      },
    ],
  },
  {
    id: 'preview',
    icon: Eye,
    title: 'Live preview',
    intro: 'See your app rendered as you build it, without leaving the IDE.',
    items: [
      {
        heading: 'HTML projects',
        body: 'Static HTML/CSS/JS projects preview instantly in an embedded panel — no extra setup needed.',
      },
      {
        heading: 'Next.js projects',
        body: 'Next.js projects start a real local dev server behind the scenes to render your app. This can take a few seconds to spin up the first time or after a large change.',
      },
    ],
  },
  {
    id: 'collaboration',
    icon: Users,
    title: 'Collaborating with a team',
    intro: 'Projects are shared spaces — build together in real time.',
    items: [
      {
        heading: 'Inviting teammates',
        body: 'From the top bar of a project, invite a teammate by email. Anyone you invite gets access to the same project, files, chat history, and terminal.',
      },
      {
        heading: 'Real-time sync',
        body: 'File edits, chat messages, and project state sync to everyone in the project live. The top bar shows a badge for the most recent change and who made it.',
      },
    ],
  },
  {
    id: 'github-deploy',
    icon: GitBranch,
    title: 'GitHub sync & deploying',
    intro: 'Take your project out of the browser and into the real world.',
    items: [
      {
        heading: 'Connect GitHub',
        body: 'If you signed in with GitHub, you can link a project to a GitHub repository. Once linked, edits you commit are pushed to that repo automatically, keeping GitHub as your project\'s source of truth.',
      },
      {
        heading: 'Deploy to Vercel',
        body: 'Use the Deploy action to publish your current project to the web. HTML and Next.js projects are both supported — you\'ll get a live URL when the deployment finishes.',
      },
    ],
  },
  {
    id: 'other',
    icon: Boxes,
    title: 'Good to know',
    intro: '',
    items: [
      {
        heading: 'Theme',
        body: 'Toggle dark/light mode from the top bar — your preference is remembered on this device.',
        icon: Moon,
      },
      {
        heading: 'Hackathons',
        body: 'If you\'re participating in a YouthDevs hackathon, your project can be flagged and submitted for review directly from your dashboard once submissions are open.',
        icon: Rocket,
      },
      {
        heading: 'Getting help',
        body: 'If something looks broken or you\'re stuck, reach out to your event organizer or the YouthDevs team.',
        icon: MessageSquare,
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06110f] text-slate-100 selection:bg-emerald-300 selection:text-[#06110f]">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(34,211,238,0.12),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:auto,auto,72px_72px,72px_72px]" />

      <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="YouthDevs IDE home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_28px_rgba(52,211,153,0.16)]">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
          </span>
          <span className="font-mono text-sm font-bold tracking-[0.18em] text-white">YOUTHDEVS<span className="text-emerald-300">.IDE</span></span>
        </Link>
        <Link href="/workspace" className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/5">
          Open workspace
        </Link>
      </nav>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16 pt-10 lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-200">
          <Keyboard size={13} />
          User guide
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">
          How to use the <span className="text-emerald-300">YouthDevs IDE</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          A quick reference for everything in your workspace: the editor, the AI assistant, the terminal, live preview, collaboration, and shipping your project.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {sections.map(({ id, title }) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200"
            >
              {title}
            </a>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 lg:px-8">
        <div className="space-y-6">
          {sections.map(({ id, icon: Icon, title, intro, items }) => (
            <article
              key={id}
              id={id}
              className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-300">
                  <Icon size={18} />
                </span>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">{title}</h2>
              </div>
              {intro && <p className="mt-3 text-sm leading-7 text-slate-400">{intro}</p>}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {items.map(({ heading, body, icon: ItemIcon }) => (
                  <div key={heading} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      {ItemIcon && <ItemIcon size={14} className="text-emerald-300" />}
                      {heading}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/15 via-cyan-300/5 to-transparent p-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-emerald-300" />
            <p className="text-lg font-semibold text-white">Ready to build something?</p>
          </div>
          <Link
            href="/workspace"
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-6 py-3 font-semibold text-[#06110f] transition hover:-translate-y-0.5 hover:bg-emerald-200"
          >
            Go to your workspace
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>YouthDevs IDE was created by YouthDevs, a non-profit fiscally sponsored by the Hack Club.</p>
          <Link href="/" className="text-slate-300 transition hover:text-emerald-300">Back to home</Link>
        </div>
      </footer>
    </main>
  );
}
