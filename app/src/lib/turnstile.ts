// Optional Cloudflare Turnstile human check — a lightweight bot gate on the
// search action, never a signup wall. Active only when VITE_TURNSTILE_SITE_KEY
// is set (and the backend has the matching TURNSTILE_SECRET_KEY). The widget
// runs in interaction-only appearance: invisible for humans, a challenge only
// when Cloudflare is suspicious.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      execute: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const turnstileEnabled = Boolean(SITE_KEY);

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let container: HTMLElement | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/** Resolve a fresh Turnstile token, or null when the check is disabled or
 * anything goes wrong (the backend then decides — it fails open only if its
 * verify service is unreachable). */
export async function getTurnstileToken(): Promise<string | null> {
  if (!turnstileEnabled) return null;
  try {
    await loadScript();
    const ts = window.turnstile;
    if (!ts) return null;
    if (!container) {
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.bottom = "12px";
      container.style.left = "12px";
      container.style.zIndex = "9999";
      document.body.appendChild(container);
    }
    return await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000);
      const done = (token: string | null) => {
        clearTimeout(timer);
        resolve(token);
      };
      if (widgetId != null) {
        // re-execute the existing widget for a fresh token
        try {
          window.turnstile?.reset(widgetId);
          window.turnstile?.execute(widgetId);
        } catch {
          done(null);
        }
        pendingResolve = done;
        return;
      }
      pendingResolve = done;
      widgetId = ts.render(container!, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        execution: "execute",
        callback: (token: string) => pendingResolve?.(token),
        "error-callback": () => pendingResolve?.(null),
        "expired-callback": () => pendingResolve?.(null),
      });
      try {
        ts.execute(widgetId);
      } catch {
        done(null);
      }
    });
  } catch {
    return null;
  }
}

let pendingResolve: ((token: string | null) => void) | null = null;
