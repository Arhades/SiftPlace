/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Supabase (community comments, view counts, problem reports). */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Travelpayouts affiliate tracking. */
  readonly VITE_TP_MARKER?: string;
  readonly VITE_TP_TRS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
