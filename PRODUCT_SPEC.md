# SiftPlace — Product Spec (the matching app)

Build spec for the **real product frontend**: the app that takes a user's priorities and returns ranked, real listings. (Business context lives in the PRD; this is the how-to-build.)

---

## Current build — browse-first + filter + compare (latest)

The product now works like a **booking app you browse first**, with the SiftPlace
scoring engine living behind a filter — not a questionnaire you complete up front.
This supersedes the "Intake → Results" framing in the sections below; those sections
still describe the underlying inputs/scoring, which are unchanged.

- **Browse first.** The app opens straight onto the **Listings** tab (the tab
  formerly called "Matches") showing top listings for a city — **hardcoded to
  Bangkok for now** (per-user country selection is a future feature). On load it
  runs a default city-only `POST /search`; "top rated" currently = the SiftPlace
  top-scored results.
- **SiftPlace = an advanced filter.** A **Filter** button at the **top-right** of
  Listings opens the full preference panel (the inputs in *Intake inputs* below).
  **Apply filters** re-ranks every listing by **true monthly cost**. It's a more
  sophisticated version of a normal booking-app filter.
- **Tabs:** `Listings` · `Saved` · `Areas` · `Guide`.
- **Save & Compare.** Heart a listing to save it (stored in full, persisted to
  `localStorage`, survives reloads/filter changes). The **Saved** tab has a
  **Compare Listings** button → a side-by-side table. Rows: **Match %, Rent /mo,
  Est. commute fare /mo, True cost /mo, Distance to anchor (commute min),
  Living (review stars)** — the best value per row is highlighted. The three the
  product centres on (rent, distance from anchor, living = review stars) are all
  present; true cost + fare are included because they are the SiftPlace point.
- **Sub-score bars are author-owned.** The numeric calculation behind each
  listing's **Cost / Location / Living** bars is intentionally left untouched —
  it will be recomputed by the product author later. Do not change that logic.
- **Resilient free-data layer.** Overpass blocks some networks (HTTP 406) so
  `backend/osm.py` sends a User-Agent and **fails over across mirrors**; Nominatim
  blocks some IPs (HTTP 403) so `backend/geocode.py` falls back to **Photon**
  (keyless OSM geocoder) with a city-centre bias (so a bare "Bangkok" resolves to
  the metropolis, not a same-named village).

---

## Architecture

Two parts that run separately:

- **Frontend** — React (Vite + TypeScript + Tailwind) app; the UI users interact with. It does *not* compute matches; it calls the backend over HTTP.
- **Backend** — FastAPI service in `backend/`; does geocoding, fetches real listings from OpenStreetMap, and scores them.

The frontend reads the backend's location from an env var: **`VITE_API_URL`** (e.g. `http://localhost:8000` in dev, a deployed URL in prod).

## API contract

- `GET {API}/geocode?q=<place>` → `{ found: boolean, lat, lon, label }`
- `POST {API}/search` → returns `{ count, results: ListingResult[], note }`
  - **Request body:** `{ city?, anchor_lat?, anchor_lon?, weights: {cost, location, living}, budget, commute_days, max_commute, nearby: string[], vibe?, types: string[], amenities: string[], radius_m, max_listings, top_n }`
  - **ListingResult:** `{ name, area, score, rent|null, true_cost|null, price_known, commute_min, commute_cost, met_nearby[], vibe, type, matched_amenities[], subscores: {cost, location, living}, reviews[], lat, lon, source }`
- `POST {API}/score` exists too but uses demo data — use `/search` for the real product.

## User flow

1. **Intake** — user sets priorities and details.
2. **Geocode** the commute destination (`GET /geocode`) → coordinates.
3. **Search** — `POST /search` with the prefs + anchor coordinates.
4. **Results** — show ranked cards.

## Intake inputs (mirror `frontend/prototype.html`)

- **Weights:** up to **20 points** across Cost / Location / Living (sliders, live total, hard cap at 20).
- Budget (per month), commute days/week, max commute (minutes).
- City (text), commute destination (text → geocoded to the anchor).
- **Nearby wants** (chips): gym, supermarket, transit, mall, flea_market.
- **Street vibe:** quiet / lively / either.
- **Place type:** condo / hotel / hostel.
- **Amenities:** wifi, desk, kitchen, laundry, gympool.
- **Commute mode:** ride-hailing **car** (Grab/Bolt) or **motorbike taxi** (cheaper, faster in traffic) — drives the fare calculator.
- **Value your time (optional):** a ฿/hour the user puts on commute time, so the trade-off can weigh time, not only money.

## Scoring (keep it transparent — show users *why*)

Each listing is scored 0–100 as a weighted blend of three explainable sub-scores:

- **Cost** — rewards being comfortably under budget on the **true** cost (rent + estimated commute). When the price is unknown (real OSM data), this is neutral and `price_known` is `false`.
- **Location** — proximity to the chosen nearby wants + safety + quiet/lively match.
- **Living** — amenities matched + place type + space.

A **max-commute tolerance penalty** lowers places that exceed the user's accepted commute. Surface the `subscores` in the UI so the ranking is explainable, not a black box.

## Fare calculator & cost trade-off (the headline feature)

SiftPlace's core insight made concrete: a cheaper place far from the anchor can cost *more* once you add the daily ride-hailing fare — and burn your time. For every listing, estimate and compare.

**Estimate the monthly commute fare per listing:**

- `fare_one_way = base_fare + per_km × distance_km + per_min × minutes`, computed for the chosen mode (Grab/Bolt **car** and **motorbike taxi**).
- `monthly_fare = fare_one_way × 2 (round trip) × commute_days_per_week × 4.3`.
- Distance/time come from routing (OpenRouteService, or the OSM estimate already in `scoring.py`). Keep the rate constants (base, per-km, per-min, separately for car vs bike) in **one config object** so they're easy to tune to current rates.

**True monthly cost = rent + monthly_fare.** Rank and compare on this, never rent alone.

**Show the trade-off explicitly** when a cheaper-farther option and a pricier-closer one both match, e.g.:

> *"Ari studio: ฿11,000 rent + ฿3,400 Grab = **฿14,400/mo**, ~70 min/day. Asok condo: ฿15,000 rent + ฿700 = **฿15,700/mo**, ~15 min/day. The cheaper place saves ฿1,300/mo but costs you ~22 extra hours a month."*

**Factor time.** Always show monthly commute hours. If the user set a value-of-time (฿/hour), add `time_cost = hours × rate` to a "true cost incl. time" figure so ranking can weigh time, not just money. Nice extra: a **break-even** line — "paying ฿X more to live closer pays off if you commute ≥ N days/week."

## Result card

Show: match score (%), name / area / type, **true monthly cost** (rent + ~commute) — or **"price on request"** when `price_known` is `false` — commute minutes, met nearby wants (chips), vibe, a top review snippet, and a map/link. Break the true cost into **rent + estimated Grab/Bolt fare**, show **monthly commute hours**, and — when a cheaper-farther option competes with a pricier-nearer one — surface the explicit trade-off (who wins on money, and by how much time).

## States to handle

- **Loading** (while geocoding + searching).
- **Empty** — "No places found near there — try a wider radius or a different area."
- **Error** — backend unreachable → friendly message (don't show a blank screen).

## Honest data note (build for this now)

`/search` returns **real** names, coordinates, and nearby distances (free OpenStreetMap) — but **no real prices, amenities, or reviews** yet. Those are unknown until a commercial listings source is connected. Design the cards to gracefully handle missing price/amenities (`price_known: false`).

**Fares are estimates too.** Bolt/Grab have no public fare API, so the fare calculator uses a transparent model (base + per-km + per-min, separate rates for car vs bike, calibrated to local Bangkok prices) — not live prices. Label it an *estimate*, keep the rate constants in one config, and refine later with sampled real fares or a partner API.

## Design

Match the `waitlist/` stack and design tokens (React 19, TypeScript, Tailwind 4) so the product and the marketing site feel like one brand. Indigo theme.

## Out of scope for v1

Auth, payments, cross-device saved favourites, admin tools, the waitlist (already built).

## Run locally (two terminals)

```bash
# 1) backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload   # http://localhost:8000

# 2) frontend (your new app/ folder)
cd app && npm install && VITE_API_URL=http://localhost:8000 npm run dev
```
