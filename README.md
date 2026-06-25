# SiftPlace — App (Phase 1)

The SiftPlace engine: a user sets how much they care about **cost, location and living conditions** (up to 20 points across the three) plus what they want nearby, and the app returns a ranked shortlist with the **true cost of the commute**, nearby-distance matches, street vibe, and review snippets.

Two ways to get listings:

- **Demo mode** (`/score`) — five mock Bangkok listings, fully specified (price, amenities, reviews). Great for trying the UI offline.
- **Real mode** (`/search`) — real lodging for **any city**, pulled live from free OpenStreetMap data.

## Structure

```
siftplace-app/
  backend/
    main.py                 FastAPI app: /health, /geocode, /score, /search
    scoring.py              weighted scoring engine (pure Python, tested)
    geocode.py              place name -> coordinates (free Nominatim)
    osm.py                  real lodging + nearby POIs (free Overpass)
    search.py               builds & scores real listings for any city
    models.py               request/response schemas
    data/sample_listings.json   5 mock Bangkok listings (demo mode)
    requirements.txt
    Dockerfile              minimal container (your Docker starting point)
  frontend/
    index.html              minimal app UI (calls /score)
    prototype.html          full designed prototype (client-side demo + geocoding)
```

## Run it locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Interactive API docs (try every endpoint in the browser): http://localhost:8000/docs

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /health` | Sanity check. |
| `GET /geocode?q=Imperial College London` | Place name → coordinates (Nominatim). |
| `POST /score` | Rank the **demo** Bangkok listings (mock data, has prices). |
| `POST /search` | Rank **real** OpenStreetMap listings for any city. |

### Example: real search for any city

```bash
curl -X POST http://localhost:8000/search -H "Content-Type: application/json" -d '{
  "city": "Lisbon",
  "weights": {"cost": 8, "location": 8, "living": 4},
  "budget": 1200,
  "nearby": ["gym", "supermarket", "transit"],
  "vibe": "quiet",
  "max_commute": 40
}'
```

You can also pass `anchor_lat`/`anchor_lon` instead of (or with) `city` to score around an exact point.

## Honest data limitations (read this)

`/search` returns **real names, coordinates and nearby distances** from OpenStreetMap — for free, worldwide. But OSM has **no rent prices, amenities, or reviews**, so those fields come back unknown:

- `price_known: false`, `rent: null`, `true_cost: null`
- the cost sub-score falls back to **neutral**, so ranking leans on location + commute
- a `note` in the response says exactly this

To make `/search` fully useful (real prices + amenities), connect a commercial listings source (e.g. a hotel/affiliate API, or your own scraped/partner inventory) and fill those fields before scoring. That's the next real-data step — and the genuine moat.

## Be a good API citizen

- **Nominatim** and **Overpass** are free, community-run, and rate-limited (~1 req/sec). `geocode.py` caches results in-process; do the same for Overpass and add a real contact to the Nominatim `User-Agent` before any real traffic.
- Don't call them per-request at scale — **precompute and cache** per city.

## Run the backend with Docker

```bash
cd backend
docker build -t siftplace-api .
docker run -p 8000:8000 siftplace-api
```

## Point the frontend at real data

`frontend/prototype.html` currently scores client-side on demo data (with live geocoding for the commute field). To use real listings, have it `POST` the user's prefs to `http://localhost:8000/search` and render the returned `results` (handle `price_known: false` by showing "price on request"). Ask and this can be wired up.

## Where to extend next

- **Prices & amenities:** connect a listings/affiliate API and fill `price`/`amenities` before scoring.
- **Caching:** store geocode + Overpass results per city so you're not hitting the public APIs repeatedly.
- **Capture preferences:** log each `/search` request + which result the user picks — that real interaction data is what a later ML ranking model trains on.

> Scope note: `/search` proves the engine works on real, global data for free. Don't over-build — the next decisive step is real prices and more validated users, not more features.
