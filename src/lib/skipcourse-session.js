const SESSION_KEY = 'skipcourse_ide_session';
const SESSION_TTL_MS = 55 * 60 * 1000;

const ALLOWED_BRIDGE_ORIGINS = new Set([
  'https://skipcourse.com',
  'https://deepvalidation.skipcourse.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const DEFAULT_BRIDGE_BASE =
  process.env.NEXT_PUBLIC_SKIPCOURSE_AUTH_BRIDGE_URL || 'https://deepvalidation.skipcourse.com/auth/ide-bridge';

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.uid || !parsed?.idToken || !parsed?.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSkipCourseSession() {
  return readStoredSession();
}

export function clearSkipCourseSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function saveSkipCourseSession({ uid, idToken, email }) {
  const session = {
    uid,
    idToken,
    email: email || '',
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function openSkipCourseLoginPopup() {
  if (typeof window === 'undefined') {
    throw new Error('Login is only available in the browser.');
  }

  const targetOrigin = window.location.origin;
  const bridgeUrl = new URL(DEFAULT_BRIDGE_BASE);
  bridgeUrl.searchParams.set('targetOrigin', targetOrigin);

  const popup = window.open(
    bridgeUrl.toString(),
    'skipcourse-auth',
    'width=520,height=720,menubar=no,toolbar=no,location=yes,status=no',
  );

  if (!popup) {
    throw new Error('Popup blocked. Allow popups for this site and try again.');
  }

  return popup;
}

export function listenForSkipCourseAuth(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let popupRef = null;
    let popupPoll = null;
    let timeoutId = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (popupPoll !== null) window.clearInterval(popupPoll);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };

    const finish = (handler) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler();
    };

    const onMessage = (event) => {
      if (!ALLOWED_BRIDGE_ORIGINS.has(event.origin)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[SkipCourse] Ignored postMessage from unexpected origin:',
            event.origin,
            '(expected one of',
            [...ALLOWED_BRIDGE_ORIGINS].join(', '),
            ')',
          );
        }
        return;
      }
      const data = event.data;
      if (!data || data.type !== 'SKIPCOURSE_AUTH_SUCCESS') return;
      if (!data.uid || !data.idToken) return;

      finish(() => {
        resolve(saveSkipCourseSession({
          uid: data.uid,
          idToken: data.idToken,
          email: data.email,
        }));
      });
    };

    window.addEventListener('message', onMessage);

    try {
      popupRef = openSkipCourseLoginPopup();
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      return;
    }

    popupPoll = window.setInterval(() => {
      if (popupRef?.closed) {
        finish(() => {
          reject(new Error('Sign-in window closed before authentication completed.'));
        });
      }
    }, 500);

    timeoutId = window.setTimeout(() => {
      finish(() => {
        reject(new Error('Sign-in timed out. Please try again.'));
      });
    }, timeoutMs);
  });
}

export async function connectSkipCourseAccount() {
  const existing = getSkipCourseSession();
  if (existing) return existing;
  return listenForSkipCourseAuth();
}
