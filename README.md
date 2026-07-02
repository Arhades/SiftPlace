# SiftPlace

A **decision layer** for exchange / internship students finding a 3–6 month home
in Bangkok. Users weight **Cost / Location / Living**, and SiftPlace ranks real
listings by **true monthly cost** — rent *plus* the Grab/Bolt or motorbike-taxi
fare the commute actually costs — not rent alone. Free for students, monetised
by affiliate commission on bookings. No login wall, ever.

## Structure

```
SiftPlace/
  backend/                FastAPI service (Python)
    main.py               endpoints: /health /rates /geocode /flood-risk /parse /score /search
    scoring.py            weighted scoring engine (sharpened weights, occupancy/stay aware)
    search.py             orchestration: geocode → providers → POIs → score → spread picks
    providers/            pluggable listings sources
      base.py             ListingsProvider interface
      osm_provider.py     OpenStreetMap (always on, real places, no prices)
      travelpayouts.py    Hotellook prices + affiliate booking links
      hotelbeds.py        Hotelbeds APItude (sandbox, signed requests)
      stubs.py            Agoda / Expedia skeletons (dormant until keys exist)
      merge.py            cross-provider fuzzy de-dupe + price-offer merging
    rates.py              daily-cached FX (THB base) + fallback table
    nlp.py                free-text demand parser (rules; optional LLM)
    flood.py              Open-Meteo weather + flood-risk heuristic
    fare.py               Bangkok ride-hailing fare estimator (the config object)
    geocode.py            Nominatim with Photon fallback
    .env.example          every backend key documented (all optional)
  app/                    the product frontend (React 19 + TS + Tailwind 4, PWA)
  waitlist/               marketing site (same stack + design tokens)
  frontend/prototype.html interactive UX reference
  PRODUCT_SPEC.md         build spec
```

## Run it locally (two terminals)

```bash
# 1) backend — http://localhost:8000  (interactive docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload        # Windows shortcut: run.bat

# 2) product app — http://localhost:5173
cd app
npm install
npm run dev                      # VITE_API_URL defaults to http://localhost:8000
```

## Environment variables (all optional — features degrade gracefully)

**Backend** (see `backend/.env.example` for the full annotated list):

| Var | Enables |
|---|---|
| `TRAVELPAYOUTS_TOKEN` + `TRAVELPAYOUTS_MARKER` | Hotellook real prices + commission-tracked booking links |
| `HOTELBEDS_API_KEY` + `HOTELBEDS_SECRET` | Hotelbeds sandbox prices (signed `X-Signature` requests) |
| `AGODA_API_KEY` / `EXPEDIA_API_KEY` … | dormant provider skeletons, ready for keys |
| `ANTHROPIC_API_KEY` | LLM parsing of the "anything else?" note (keyword rules otherwise) |
| `TURNSTILE_SECRET_KEY` | optional Cloudflare Turnstile human check on /search |
| `SIFTPLACE_SEARCH_LIMIT` … | per-IP rate limits (defaults: 15/min search, 30/min parse+geocode) |

**Frontend** (`app/.env.example`): `VITE_API_URL`, optional `VITE_TURNSTILE_SITE_KEY`.

Keys live server-side only; the browser never sees them.

## What the product does

- **Browse-first**: opens on ranked Bangkok listings; the **Filter** holds the
  full weighted intake (weights up to 20 pts, budget **in any of 8 currencies**,
  stay dates, occupancy 1–8, commute mode, nearby wants, vibe, place type,
  amenities — every question with an **Other…** free-text option, plus an
  "Anything else?" note parsed by NLP with detected demands shown back).
- **True-cost ranking**: rent + estimated ride-hailing fare (`fare.py` config),
  monthly commute hours, optional value-of-time; transparent sub-scores on every
  card.
- **Real trade-offs**: sharpened weight normalisation + an adaptive search
  radius (cost-driven or location-flexible profiles search wider), and the
  shortlist always includes a *best value further out* and a *best quality* pick.
- **Price comparison**: the same place across booking sites, cheapest
  highlighted, one affiliate-tagged **Book** button per provider; unpriced OSM
  places say "price on request".
- **Weather + flood risk** per area (Open-Meteo, cached, tunable heuristic) with
  a rainy-season (Sep–Oct) warning when the stay overlaps it.
- **Robust UX**: re-applying filters aborts the in-flight search (no stale
  results) behind a staged progress bar; loading/empty/error states everywhere;
  installable PWA that also works as a responsive website.

## Honest data limitations

OpenStreetMap gives real places, coordinates and nearby distances — no prices,
amenities or reviews. Real prices appear per listing once an affiliate feed is
configured. Fares are transparent estimates (no public Grab/Bolt API). Flood
risk is a rough open-data heuristic, not a hydrological model.

## Be a good API citizen

Geocoding (Nominatim/Photon), Overpass, FX and weather calls are cached
in-process and rate-limited per IP. Put a real contact in the `User-Agent`
strings in `backend/osm.py` / `backend/geocode.py` before any public deploy,
and tighten CORS `allow_origins` in `backend/main.py`.

## Docker (backend)

```bash
cd backend
docker build -t siftplace-api .
docker run -p 8000:8000 siftplace-api
```
