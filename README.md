# SiftPlace

A **decision layer** for exchange / internship students finding a 3–6 month home
in Bangkok. Users weight **Cost / Location / Living**, and SiftPlace ranks real
listings by **true monthly cost** — rent *plus* the Grab/Bolt or motorbike-taxi
fare the commute actually costs — not rent alone. Free for students, monetised
by affiliate commission on bookings. No login wall, ever.

## Structure

See **[docs/architecture.md](docs/architecture.md)** for a diagram of how these
modules connect.

```
SiftPlace/
  backend/                FastAPI service (Python)
    main.py               endpoints: /health /rates /geocode /flood-risk /parse
                          /score /search + token-gated /admin dashboard
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
    nlp.py                free-text demand parser (keyword rules + TRAINED classifier)
    nlp_train.py          retrains the classifier on accumulated notes (NB vs MLP)
    flood.py              seasonal heavy-rain climatology + flood-risk heuristic
    fare.py               Bangkok ride-hailing fare estimator (the config object)
    geocode.py            Nominatim with Photon fallback (1 req/s self-throttle)
    apicache.py           persistent SQLite TTL cache for all outbound API results
    usage.py              search log (hashed IPs) + per-provider daily call counters
    precompute.py         warms the cache for the key Bangkok areas (run daily)
    admin.html            founder dashboard page (served at /admin)
    tests/                golden behaviour tests (python tests/test_behavior.py)
    .env.example          every backend key documented (all optional)
  app/                    the product frontend (React 19 + TS + Tailwind 4, PWA)
  waitlist/               marketing site (same stack + design tokens)
  frontend/prototype.html interactive UX reference
  docs/architecture.md    component/flow diagram (Mermaid)
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
| `ADMIN_TOKEN` | the founder dashboard at `/admin` (usage, spam watch, API budgets, NLP retrain) — verified server-side |
| `TURNSTILE_SECRET_KEY` | optional Cloudflare Turnstile human check on /search |
| `SIFTPLACE_SEARCH_LIMIT` … | per-IP rate limits (defaults: 15/min search, 30/min parse+geocode) |
| `SIFTPLACE_IP_SALT` | salt for the hashed IPs in the usage log |

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
- **Seasonal flood risk** per area (Open-Meteo monthly climatology: how much of
  the month typically sees heavy rain, + season + elevation; tunable heuristic)
  with a rainy-season (Sep–Oct) warning when the stay overlaps it.
- **Self-improving free-text parsing**: the "anything else?" note is parsed by
  keyword rules UNIONED with a locally trained classifier (Porter-stemmed bag
  of words → Naive Bayes vs MLP, better one wins). Every note accumulates as
  weakly-labelled training data; retrain in batches with `python nlp_train.py`
  or one click on `/admin`. No external AI API involved.
- **Robust UX**: re-applying filters aborts the in-flight search (no stale
  results) behind a staged progress bar; loading/empty/error states everywhere;
  installable PWA that also works as a responsive website.

## Honest data limitations

OpenStreetMap gives real places, coordinates and nearby distances — no prices,
amenities or reviews. Real prices appear per listing once an affiliate feed is
configured. Fares are transparent estimates (no public Grab/Bolt API). Flood
risk is a rough open-data heuristic, not a hydrological model.

## Be a good API citizen

The free, community-run APIs (Overpass, Nominatim, Open-Meteo) throttle or
IP-ban heavy users, so the backend is built to hit them as little as possible:

- **Persistent cache** (`apicache.py`, SQLite): Overpass and geocoding results
  are stored with TTLs and keyed on ~2 km area buckets + coarse radius steps,
  so repeated and adjacent searches reuse one stored query. Overpass runs at
  most 2 concurrent queries.
- **Precompute**: `python precompute.py` (run daily, e.g. cron/Task Scheduler)
  warms the cache for the key Bangkok areas — live Overpass calls become the
  exception, not per-search.
- **Self-throttling**: Nominatim/Photon calls are spaced ≥ 1 s apart
  (Nominatim's absolute-max policy). Flood climatology is cached for 30 days,
  FX for a day. The frontend only searches on an explicit submit and skips
  identical re-applies.
- **Budget visibility**: `/admin` shows per-provider calls today vs each free
  limit, cache hit-rate, and flags spammy IPs — so you see trouble before a
  block happens.

Put a real contact in the `User-Agent` strings in `backend/osm.py` /
`backend/geocode.py` before any public deploy, and tighten CORS
`allow_origins` in `backend/main.py`.

**Scaling path**: at real volume, self-host Overpass + Nominatim (official
Docker images) or move to paid providers; the affiliate listing feeds also
carry their own inventory, which cuts the Overpass reliance further.

## Docker (backend)

```bash
cd backend
docker build -t siftplace-api .
docker run -p 8000:8000 siftplace-api
```
