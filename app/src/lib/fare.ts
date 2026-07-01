// Pure display helpers for the fare / true-cost trade-off. These operate ONLY on
// numbers the backend already returned — the rate constants live server-side in
// backend/fare.py (the spec's "one config object").

import type { CommuteMode, ListingResult } from "@/lib/api";

export function fmtTHB(n: number | null | undefined): string {
  if (n == null) return "—";
  return "฿" + Math.round(n).toLocaleString("en-US");
}

export function fmtHours(h: number | null | undefined): string {
  if (h == null) return "—";
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

export const MODE_LABEL: Record<CommuteMode, string> = {
  car: "Grab/Bolt car",
  bike: "motorbike taxi",
};

export const MODE_SHORT: Record<CommuteMode, string> = {
  car: "Car",
  bike: "Bike",
};

export function otherMode(mode: CommuteMode): CommuteMode {
  return mode === "car" ? "bike" : "car";
}

/** Monthly-fare bands (THB) for the commute-cost badge. */
export function commuteLevel(monthlyFare: number | null | undefined): "low" | "moderate" | "high" {
  const f = monthlyFare ?? 0;
  if (f <= 2000) return "low";
  if (f <= 4500) return "moderate";
  return "high";
}

export const COMMUTE_LEVEL_TEXT: Record<"low" | "moderate" | "high", string> = {
  low: "Cheap commute",
  moderate: "Moderate commute",
  high: "Costly commute",
};

export interface TradeOffData {
  near: ListingResult; // shortest commute among the compared pair
  far: ListingResult; // longest commute
  fareDiff: number; // monthly THB the far option pays MORE in fare
  hoursDiff: number; // monthly hours the far option costs MORE
  rentKnown: boolean;
  /** near.rent - far.rent (positive => closer place is pricier to rent). */
  rentPremium: number | null;
  trueCostNear: number | null;
  trueCostFar: number | null;
  /** trueCostFar - trueCostNear (positive => the closer place wins on total money). */
  netSaving: number | null;
  /** Days/week you'd need to commute for the closer place's rent premium to pay off. */
  breakEvenDays: number | null;
}

/**
 * The headline SiftPlace insight: a place's distance costs money (fare) and time.
 * Compares the closest vs the farthest of the ranked results. Returns null when
 * there's no meaningful spread to talk about.
 */
export function computeTradeOff(
  results: ListingResult[],
  commuteDays: number,
): TradeOffData | null {
  if (results.length < 2) return null;

  let near = results[0];
  let far = results[0];
  for (const r of results) {
    if (r.commute_min < near.commute_min) near = r;
    if (r.commute_min > far.commute_min) far = r;
  }
  if (near === far) return null;

  const fareDiff = (far.monthly_fare ?? 0) - (near.monthly_fare ?? 0);
  const hoursDiff = Math.round((far.monthly_hours - near.monthly_hours) * 10) / 10;
  if (fareDiff <= 0 && hoursDiff <= 0) return null;

  const rentKnown =
    near.price_known && far.price_known && near.rent != null && far.rent != null;

  let rentPremium: number | null = null;
  let trueCostNear: number | null = null;
  let trueCostFar: number | null = null;
  let netSaving: number | null = null;
  let breakEvenDays: number | null = null;

  if (rentKnown) {
    rentPremium = (near.rent as number) - (far.rent as number);
    trueCostNear = near.true_cost;
    trueCostFar = far.true_cost;
    if (trueCostNear != null && trueCostFar != null) {
      netSaving = trueCostFar - trueCostNear;
    }
    // Closer place is pricier to rent, but saves fare. When does it pay off?
    if (rentPremium > 0 && fareDiff > 0 && commuteDays > 0) {
      const perDaySaving = fareDiff / commuteDays;
      breakEvenDays = Math.round((rentPremium / perDaySaving) * 10) / 10;
    }
  }

  return {
    near,
    far,
    fareDiff,
    hoursDiff,
    rentKnown,
    rentPremium,
    trueCostNear,
    trueCostFar,
    netSaving,
    breakEvenDays,
  };
}

/** OpenStreetMap deep link centred on a listing (matches our data source). */
export function osmLink(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return "https://www.openstreetmap.org/";
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
