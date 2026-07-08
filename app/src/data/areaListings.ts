// Top popular listings per neighbourhood for the Areas tab click-through — a
// fast, zero-API look at what each area offers. Curated sample data with
// estimated prices (clearly labelled in the UI), built as full ListingResult
// objects so saving / comparing / the commute-mode maths all keep working.
//
// Fares follow the backend fare model's shape (backend/fare.py), anchored on
// the Siam / Chula city core like the featured starter picks.

import type { CostOfLiving, ListingResult } from "@/lib/api";

const COL_BKK: CostOfLiving = {
  utilities: 2600,
  internet: 600,
  mobile: 350,
  food: 9000,
  total: 12550,
  note: "rough per-person estimates",
  source: "Numbeo open data snapshot, mid-2026",
};

const DAYS = 21.5; // commuting days/month used across the fare model
const round1 = (n: number) => Math.round(n * 10) / 10;

interface AreaPick {
  name: string;
  rent: number;
  type: string;
  vibe: "quiet" | "lively";
  met: string[];
  lease: "standard" | "short_term" | "monthly";
  carFare: number; // one-way Grab/Bolt car estimate, THB
  carMin: number; // one-way car minutes to the city core
  walkMin: number;
  lat: number;
  lon: number;
  stars?: number;
}

function mk(area: string, score: number, p: AreaPick): ListingResult {
  const fare = (oneWay: number, min: number) => ({
    one_way_thb: oneWay,
    one_way_min: min,
    monthly_fare_thb: Math.round(oneWay * 2 * DAYS),
    monthly_hours: round1((min * 2 * DAYS) / 60),
  });
  const car = fare(p.carFare, p.carMin);
  const bike = fare(Math.round(p.carFare * 0.4), Math.max(2, Math.round(p.carMin * 0.7)));
  const transit = fare(p.carMin <= 8 ? 16 : 18, Math.max(2, Math.round(p.carMin * 0.85)));
  const walk = fare(0, p.walkMin);

  return {
    name: p.name,
    area,
    score,
    rent: p.rent,
    true_cost: p.rent + car.monthly_fare_thb,
    true_cost_incl_time: null,
    price_known: true,
    commute_min: car.one_way_min,
    commute_cost: car.monthly_fare_thb,
    mode: "car",
    one_way_fare: car.one_way_thb,
    monthly_fare: car.monthly_fare_thb,
    monthly_hours: car.monthly_hours,
    time_cost: null,
    fares: { car, bike, transit, walk },
    met_nearby: p.met,
    vibe: p.vibe,
    type: p.type,
    matched_amenities: [],
    subscores: {},
    reviews: [],
    lat: p.lat,
    lon: p.lon,
    source: "featured", // curated sample — accuracy votes/comments stay off
    offers: [],
    sources: ["featured"],
    stars: p.stars ?? null,
    badge: null,
    lease_type: p.lease,
    cost_of_living: COL_BKK,
    community: null,
    semantic: null,
    ai_reason: null,
  };
}

/** Keyed by the AREAS card name (lib/constants.ts) — 3 popular picks each. */
export const AREA_LISTINGS: Record<string, ListingResult[]> = {
  Ari: [
    mk("Ari", 90, { name: "Ari Green Lane Rooms", rent: 12500, type: "condo", vibe: "quiet", met: ["supermarket", "gym"], lease: "standard", carFare: 86, carMin: 10, walkMin: 33, lat: 13.7797, lon: 100.5405 }),
    mk("Ari", 86, { name: "Soi Ari Courtyard Condo", rent: 15000, type: "condo", vibe: "quiet", met: ["transit", "supermarket"], lease: "standard", carFare: 84, carMin: 10, walkMin: 32, lat: 13.7802, lon: 100.5432 }),
    mk("Ari", 82, { name: "Phahon Yothin Micro Loft", rent: 9500, type: "condo", vibe: "lively", met: ["transit", "mall"], lease: "monthly", carFare: 90, carMin: 11, walkMin: 36, lat: 13.7825, lon: 100.5470 }),
  ],
  Samyan: [
    mk("Samyan", 92, { name: "Samyan Campus Studio", rent: 14000, type: "condo", vibe: "quiet", met: ["transit", "supermarket"], lease: "standard", carFare: 60, carMin: 3, walkMin: 10, lat: 13.7325, lon: 100.5296 }),
    mk("Samyan", 88, { name: "Chula Gate Residence", rent: 16500, type: "condo", vibe: "quiet", met: ["transit", "supermarket", "gym"], lease: "short_term", carFare: 58, carMin: 3, walkMin: 9, lat: 13.7352, lon: 100.5270 }),
    mk("Samyan", 84, { name: "Sam Yan Market Rooms", rent: 9800, type: "hostel", vibe: "lively", met: ["flea_market", "supermarket"], lease: "monthly", carFare: 62, carMin: 4, walkMin: 12, lat: 13.7330, lon: 100.5312 }),
  ],
  Ratchathewi: [
    mk("Ratchathewi", 90, { name: "Ratchathewi Skytrain Loft", rent: 15500, type: "condo", vibe: "lively", met: ["transit", "mall"], lease: "standard", carFare: 64, carMin: 4, walkMin: 15, lat: 13.7519, lon: 100.5326 }),
    mk("Ratchathewi", 86, { name: "Victory Monument Studio", rent: 11000, type: "condo", vibe: "lively", met: ["transit", "flea_market"], lease: "monthly", carFare: 72, carMin: 7, walkMin: 24, lat: 13.7649, lon: 100.5383 }),
    mk("Ratchathewi", 82, { name: "Phaya Thai Garden Flat", rent: 13000, type: "condo", vibe: "quiet", met: ["transit", "supermarket"], lease: "standard", carFare: 68, carMin: 5, walkMin: 19, lat: 13.7568, lon: 100.5339 }),
  ],
  Sathorn: [
    mk("Sathorn", 90, { name: "Sathorn Serviced Suites", rent: 19500, type: "hotel", vibe: "quiet", met: ["transit", "gym"], lease: "monthly", carFare: 76, carMin: 8, walkMin: 25, lat: 13.7211, lon: 100.5295, stars: 4 }),
    mk("Sathorn", 86, { name: "Chong Nonsi City Loft", rent: 14500, type: "condo", vibe: "quiet", met: ["transit", "supermarket"], lease: "standard", carFare: 80, carMin: 9, walkMin: 28, lat: 13.7205, lon: 100.5342 }),
    mk("Sathorn", 82, { name: "Lumpini Edge Rooms", rent: 12000, type: "condo", vibe: "quiet", met: ["gym", "supermarket"], lease: "short_term", carFare: 70, carMin: 6, walkMin: 21, lat: 13.7266, lon: 100.5390 }),
  ],
  "Phrom Phong": [
    mk("Phrom Phong", 90, { name: "Phrom Phong Social Pod", rent: 9000, type: "hostel", vibe: "lively", met: ["mall", "transit"], lease: "monthly", carFare: 95, carMin: 12, walkMin: 40, lat: 13.7305, lon: 100.5697 }),
    mk("Phrom Phong", 86, { name: "Em District Micro Studio", rent: 13500, type: "condo", vibe: "lively", met: ["mall", "transit", "supermarket"], lease: "short_term", carFare: 96, carMin: 12, walkMin: 41, lat: 13.7311, lon: 100.5688 }),
    mk("Phrom Phong", 82, { name: "Sukhumvit 39 Residence", rent: 17500, type: "hotel", vibe: "quiet", met: ["mall", "gym"], lease: "monthly", carFare: 98, carMin: 13, walkMin: 44, lat: 13.7338, lon: 100.5701, stars: 4 }),
  ],
  "Thong Lo": [
    mk("Thong Lo", 90, { name: "Thong Lo Nightlife Loft", rent: 24000, type: "condo", vibe: "lively", met: ["transit", "mall", "gym"], lease: "standard", carFare: 110, carMin: 15, walkMin: 52, lat: 13.7262, lon: 100.5787 }),
    mk("Thong Lo", 86, { name: "J-Avenue Garden Studio", rent: 19000, type: "condo", vibe: "quiet", met: ["supermarket", "gym"], lease: "short_term", carFare: 112, carMin: 15, walkMin: 53, lat: 13.7332, lon: 100.5810 }),
    mk("Thong Lo", 82, { name: "Ekkamai Border Rooms", rent: 14000, type: "condo", vibe: "quiet", met: ["transit", "supermarket"], lease: "monthly", carFare: 118, carMin: 16, walkMin: 56, lat: 13.7245, lon: 100.5852 }),
  ],
};
