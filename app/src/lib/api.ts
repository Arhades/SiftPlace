// HTTP client + types for the SiftPlace FastAPI backend.
// The frontend does NOT compute matches — it calls these endpoints. The backend
// location comes from VITE_API_URL (see .env.example).

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export type CommuteMode = "car" | "bike" | "transit" | "walk";
export type Provider = "grab" | "bolt";

export interface Weights {
  cost: number;
  location: number;
  living: number;
}

/** Mirrors backend CityScoreRequest. */
export interface SearchRequest {
  city?: string;
  anchor_lat?: number;
  anchor_lon?: number;
  weights: Weights;
  budget: number;
  currency: string;
  check_in?: string | null; // ISO date
  check_out?: string | null;
  occupancy: number;
  notes?: string | null;
  other_terms: string[];
  commute_days: number;
  max_commute: number;
  nearby: string[];
  vibe?: string | null;
  types: string[];
  amenities: string[];
  commute_mode: CommuteMode;
  provider: Provider;
  value_of_time: number;
  radius_m: number;
  max_listings: number;
  top_n: number;
  /** Pagination: which page of ranked results to return (1-based). */
  page: number;
  page_size: number;
  /** Lease-length filter: standard | short_term | monthly (empty = any). */
  lease_types: string[];
  /** Privacy: allow the submitted note to be stored as NLP training data. */
  allow_training: boolean;
}

/** One mode's fare summary (from backend fare.py). */
export interface FareSummary {
  one_way_thb: number;
  one_way_min: number;
  monthly_fare_thb: number;
  monthly_hours: number;
}

export interface Review {
  stars: number;
  text: string;
}

export interface SubScores {
  cost: number;
  location: number;
  living: number;
}

/** One provider's price for a listing (affiliate link carries the marker). */
export interface Offer {
  provider: string;
  label: string;
  monthly_thb: number;
  nightly_thb: number | null;
  url: string | null;
}

export type Badge = "top_match" | "best_value" | "best_quality";

/** "What else you'll spend" — rough per-person monthly extras (THB). */
export interface CostOfLiving {
  utilities: number | null;
  internet: number | null;
  mobile: number | null;
  food: number | null;
  total: number | null;
  note: string;
  source: string;
}

/** Community accuracy feedback aggregate for a listing. */
export interface Community {
  up: number;
  down: number;
  /** 3+ negatives (and more downs than ups) — shown as a caution chip. */
  flagged: boolean;
}

/** Mirrors backend ListingResult. */
export interface ListingResult {
  name: string;
  area: string;
  score: number;
  rent: number | null;
  true_cost: number | null;
  true_cost_incl_time: number | null;
  price_known: boolean;
  commute_min: number;
  commute_cost: number | null;
  mode: CommuteMode;
  one_way_fare: number | null;
  monthly_fare: number | null;
  monthly_hours: number;
  time_cost: number | null;
  fares: Partial<Record<CommuteMode, FareSummary>>;
  met_nearby: string[];
  vibe: string | null;
  type: string | null;
  matched_amenities: string[];
  subscores: Partial<SubScores>;
  reviews: Review[];
  lat: number | null;
  lon: number | null;
  source: string;
  offers: Offer[];
  sources: string[];
  stars: number | null;
  badge: Badge | null;
  /** Lease length when known: standard | short_term | monthly (null = confirm). */
  lease_type: string | null;
  cost_of_living: CostOfLiving | null;
  community: Community | null;
  /** Semantic layer (when the backend has it enabled). */
  semantic: number | null;
  ai_reason: string | null;
}

/** What the NLP layer extracted from free text (shown back to the user). */
export interface ParsedNotes {
  amenities: string[];
  nearby: string[];
  types: string[];
  vibe: string | null;
  weight_nudges: Weights;
  must_haves: string[];
  detected: string[];
  /** "rules" = keyword parser only; "model+rules" = trained classifier merged
   *  with the keyword parser (see backend nlp.py). */
  engine: "rules" | "model+rules";
}

export interface SearchResponse {
  count: number;
  results: ListingResult[];
  note: string | null;
  centre: [number, number] | null;
  radius_used: number | null;
  stay_months: number | null;
  parsed: ParsedNotes | null;
  providers: string[];
  /** Pagination: `results` holds one page; `total` counts every ranked match. */
  total: number | null;
  page: number | null;
  page_size: number | null;
  total_pages: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  parsed: ParsedNotes;
  /** Which engine answered: agnes | openai | rules-fallback(...) */
  engine: string;
}

export interface GeocodeResult {
  found: boolean;
  lat?: number;
  lon?: number;
  label?: string;
}

/** FX table: units of each currency per 1 THB (scoring base). */
export interface RatesResponse {
  base: string;
  rates: Record<string, number>;
  symbols: Record<string, string>;
  source: string;
}

export interface FloodDay {
  date: string;
  rain_mm: number;
  prob: number;
}

export type FloodRiskLevel = "low" | "moderate" | "high";

export interface FloodRisk {
  risk: FloodRiskLevel;
  reasons: string[];
  season: "peak" | "monsoon" | "dry";
  /** Which calendar month (1-12) the seasonal estimate is for. */
  month?: number;
  /** Share (%) of the month's days expected to see heavy rain (climatology);
   *  null when the seasonal data was unavailable (season-only estimate). */
  heavy_rain_pct: number | null;
  elevation_m: number | null;
  /** Legacy fields from the old 7-day-forecast model; daily is now empty. */
  week_rain_mm: number;
  max_day_mm: number;
  daily: FloodDay[];
  source: string;
}

/** Distinguishes "backend unreachable" (status 0) from an HTTP error. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}${path}`, init);
  } catch (e) {
    // an abort must bubble so stale searches can be discarded, not shown as errors
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Could not reach the SiftPlace backend.", 0);
  }
  if (!r.ok) {
    const hint = r.status === 429 ? " You're searching very fast — give it a minute." : "";
    throw new ApiError(`Request failed (${r.status}).${hint}`, r.status);
  }
  return r.json();
}

export function geocode(q: string, signal?: AbortSignal): Promise<GeocodeResult> {
  return request(`/geocode?q=${encodeURIComponent(q)}`, { signal });
}

export async function search(
  payload: SearchRequest,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // optional human check — active only when VITE_TURNSTILE_SITE_KEY is set
  const { getTurnstileToken, turnstileEnabled } = await import("@/lib/turnstile");
  if (turnstileEnabled) {
    const token = await getTurnstileToken();
    if (token) headers["x-turnstile-token"] = token;
  }
  return request(`/search`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
}

export function parseNotes(text: string, signal?: AbortSignal): Promise<ParsedNotes> {
  return request(`/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
}

export function getRates(): Promise<RatesResponse> {
  return request(`/rates`);
}

/** One Sift-mascot turn: reply + demands extracted server-side (Agnes AI ->
 *  OpenAI -> offline rules — same shape whichever engine answered). */
export function chat(
  messages: ChatMessage[],
  filtersSummary?: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return request(`/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, filters_summary: filtersSummary ?? null }),
    signal,
  });
}

/** Community accuracy vote / scam report; returns the fresh aggregate. */
export function sendFeedback(
  listing: { name: string; lat: number; lon: number },
  accurate: boolean,
  report?: string,
): Promise<{ ok: boolean; community: Community }> {
  return request(`/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...listing, accurate, report: report ?? null }),
  });
}

/** Privacy: remove a previously stored "Anything else?" note from training data. */
export function deleteStoredNote(text: string): Promise<{ deleted_rows: number }> {
  return request(`/notes/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function getFloodRisk(lat: number, lon: number, signal?: AbortSignal): Promise<FloodRisk> {
  return request(`/flood-risk?lat=${lat}&lon=${lon}`, { signal });
}

export { API as API_BASE };
