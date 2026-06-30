// HTTP client + types for the SiftPlace FastAPI backend.
// The frontend does NOT compute matches — it calls these endpoints. The backend
// location comes from VITE_API_URL (see .env.example).

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export type CommuteMode = "car" | "bike";
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
}

export interface SearchResponse {
  count: number;
  results: ListingResult[];
  note: string | null;
}

export interface GeocodeResult {
  found: boolean;
  lat?: number;
  lon?: number;
  label?: string;
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

export async function geocode(q: string): Promise<GeocodeResult> {
  let r: Response;
  try {
    r = await fetch(`${API}/geocode?q=${encodeURIComponent(q)}`);
  } catch {
    throw new ApiError("Could not reach the SiftPlace backend.", 0);
  }
  if (!r.ok) throw new ApiError(`Geocode failed (${r.status}).`, r.status);
  return r.json();
}

export async function search(payload: SearchRequest): Promise<SearchResponse> {
  let r: Response;
  try {
    r = await fetch(`${API}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError("Could not reach the SiftPlace backend.", 0);
  }
  if (!r.ok) throw new ApiError(`Search failed (${r.status}).`, r.status);
  return r.json();
}

export { API as API_BASE };
