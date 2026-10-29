// ─── Client-side session token fallback ─────────────────────────────────────
// When the app is embedded in a cross-site iframe (preview host), some
// browsers block cookies entirely. The signed session token is then kept in
// localStorage and attached to every same-origin /api/ request via a
// one-time global fetch wrapper. Server side, getSessionUser() accepts it
// through the x-session-token header.

const TOKEN_KEY = 'ac_session_token';

export function saveSessionToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable — cookie path still works
  }
}

export function clearSessionToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

let installed = false;

export function installSessionTokenHeader() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const sameOriginApi =
        url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
      if (sameOriginApi) {
        const token = window.localStorage.getItem(TOKEN_KEY);
        if (token) {
          const headers = new Headers(
            init?.headers ?? (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined)
          );
          if (!headers.has('x-session-token')) headers.set('x-session-token', token);
          return origFetch(input, { ...init, headers });
        }
      }
    } catch {
      // never break a request because of the wrapper
    }
    return origFetch(input, init);
  };
}
