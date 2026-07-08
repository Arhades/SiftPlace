// Problem / crash reporting — "tell the admin something broke".
//
// Reports go to Supabase (`problem_reports`, see docs/supabase-community.sql)
// because the most interesting failures happen exactly when OUR backend is
// unreachable — the report channel must not depend on it. When Supabase isn't
// configured the UI falls back to a pre-filled email to the founder, so the
// button always does something useful.
//
// Two entry points:
//  - reportProblem(...)      — user pressed "Report this problem"
//  - installCrashReporter()  — auto-captures uncaught errors / rejections
//    (best-effort, throttled, anonymous; wired up in main.tsx)

const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");
const SUPABASE_ANON_KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "").trim();

export const reportingEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Where fallback email reports go while Supabase reporting is not configured. */
export const ADMIN_EMAIL = "shendayang75@gmail.com";

export interface ProblemReport {
  /** "user" = pressed the report button; "crash" = uncaught error hook. */
  kind: "user" | "crash";
  message: string;
  /** Where in the app it happened (e.g. "search error state"). */
  context?: string;
}

async function insertReport(p: ProblemReport): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/problem_reports`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: p.kind,
      message: p.message.slice(0, 1000),
      context: (p.context ?? "").slice(0, 300) || null,
      url: location.href.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300),
    }),
  });
  if (!r.ok) throw new Error(`report failed (${r.status})`);
}

/** File a report. Resolves "sent" when stored, "mail" when the caller should
 *  open the mailto fallback instead (returned pre-built), never rejects. */
export async function reportProblem(
  p: ProblemReport,
): Promise<{ outcome: "sent" } | { outcome: "mail"; mailto: string }> {
  if (reportingEnabled) {
    try {
      await insertReport(p);
      return { outcome: "sent" };
    } catch {
      // fall through to the email fallback — never lose a report silently
    }
  }
  const subject = encodeURIComponent(`SiftPlace problem report (${p.kind})`);
  const body = encodeURIComponent(
    `What happened:\n${p.message}\n\nWhere: ${p.context ?? "-"}\nPage: ${location.href}\nBrowser: ${navigator.userAgent}`,
  );
  return { outcome: "mail", mailto: `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}` };
}

// ---- automatic crash capture -----------------------------------------------

const MAX_AUTO_REPORTS = 3; // per page load — one bad loop must not spam the table
let autoReports = 0;

function autoReport(message: string, context: string) {
  if (!reportingEnabled || autoReports >= MAX_AUTO_REPORTS) return;
  autoReports += 1;
  insertReport({ kind: "crash", message, context }).catch(() => {});
}

/** Call once at startup. No-op unless Supabase reporting is configured. */
export function installCrashReporter(): void {
  if (!reportingEnabled) return;
  window.addEventListener("error", (e) => {
    autoReport(String(e.error?.stack ?? e.message ?? "unknown error"), "window.onerror");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason.stack ?? e.reason.message : String(e.reason);
    autoReport(reason ?? "unhandled rejection", "unhandledrejection");
  });
}
