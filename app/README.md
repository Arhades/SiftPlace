# SiftPlace — product app

The real matching UI: browse ranked listings, open the **Filter** to set weighted
priorities (Cost / Location / Living), budget **in your own currency**, stay
dates, group size and free-text wishes — SiftPlace geocodes your commute
destination, pulls real listings from every configured source, and ranks them by
**true monthly cost** (rent + the Grab/Bolt or motorbike-taxi fare it takes to
commute), not rent alone.

It does **not** compute matches itself — it calls the FastAPI backend in
`../backend` over HTTP. The backend's location comes from `VITE_API_URL`.

## Features

- **Multi-currency budget** — THB, USD, EUR, GBP, SGD, JPY, AUD, CNY; FX from the
  backend's daily-cached `/rates`, prices displayed in your currency.
- **Stay dates + occupancy** — stay length feeds the ranking; a warning appears
  when your stay overlaps Bangkok's Sep–Oct rainy/flood window; groups need
  space, so dorm-style places rank lower for 3+.
- **"Anything else?" free text** — parsed by the backend NLP (`/parse`); the app
  shows exactly what was detected before you apply. Every question also has an
  **Other…** free-text option that feeds the same parser.
- **Weather + flood risk** — a per-area forecast card with a flood badge
  (open data via `/flood-risk`).
- **Price comparison** — when several booking sites offer the same place, prices
  show side by side, cheapest highlighted, one affiliate-tracked **Book** button
  per site. Places without a public price show **"price on request"**.
- **Spread picks** — beyond the top match, the shortlist always surfaces a
  "best value further out" and a "best quality" option so trade-offs are visible.
- **Staged progress + clean restarts** — re-applying filters aborts the
  in-flight search (stale results can never appear) and restarts the progress bar.
- **Installable PWA** — add to home screen; app shell loads offline. Fully
  responsive on desktop too. No login, ever.

## Run locally (two terminals)

```bash
# 1) backend  (http://localhost:8000)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# 2) this app
cd app && npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Then open the printed Vite URL (default http://localhost:5173).

Copy `.env.example` to `.env` to set `VITE_API_URL` permanently instead of
passing it inline. Affiliate/NLP/bot-protection keys are **backend-only** — see
`../backend/.env.example`; nothing secret ever reaches this app.

## Honest data note

OpenStreetMap listings are real places with real coordinates but **no public
prices** — cards show "price on request". Real prices + booking links appear per
listing once an affiliate feed (Travelpayouts/Hotellook, Hotelbeds, …) is
configured on the backend. **Fares are estimates** from a transparent model
(base + per-km + per-min, separate car/bike rates) in `../backend/fare.py`, not
live Grab/Bolt prices. Flood risk is a rough open-data heuristic, not hydrology.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · framer-motion · lucide-react ·
vite-plugin-pwa.
