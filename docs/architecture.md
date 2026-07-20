
# SiftPlace — architecture

How the pieces connect. The frontend never computes matches itself — it calls
the FastAPI backend, which orchestrates the engine modules below. Every module
is fail-safe: on any upstream failure it degrades (cached/neutral/fallback
values) instead of raising.

```mermaid
flowchart TB
    subgraph Frontend
        APP["app/ (React PWA)"]
        WAITLIST["waitlist/ (marketing site + Supabase)"]
    end

    subgraph Backend["backend/ — FastAPI"]
        MAIN["main.py\nendpoints + rate limits + admin gate"]

        SEARCH["search.py\nsearch orchestration"]
        SCORING["scoring.py\nweighted scoring engine"]
        FARE["fare.py\nBangkok fare estimator"]
        OSM["osm.py\nOverpass client (cached)"]
        GEO["geocode.py\nNominatim/Photon (throttled)"]
        PROV["providers/\nOSM + affiliate feeds + merge"]
        NLP["nlp.py\nrules + trained classifier"]
        TRAIN["nlp_train.py\nNB vs MLP trainer (CLI)"]
        FLOOD["flood.py\nseasonal flood heuristic"]
        RATES["rates.py\ndaily FX table"]
        CACHE[("apicache.py\nSQLite TTL cache")]
        USAGE[("usage.py\nsearch log + API counters")]
        PRE["precompute.py\nwarms Bangkok areas (cron)"]
    end

    subgraph Data["data files"]
        TERMS["nlp_terms.csv\nkeyword vocabulary"]
        TRAINCSV["nlp_training.csv\naccumulated notes"]
        MODEL["nlp_model.joblib\ntrained model"]
        DB[("data/siftplace.db")]
    end

    subgraph External["free external APIs"]
        OVERPASS["Overpass (OSM)"]
        NOMINATIM["Nominatim / Photon"]
        METEO["Open-Meteo archive"]
        ERAPI["open.er-api.com"]
    end

    APP -- "/search /parse /geocode /flood-risk /rates" --> MAIN
    MAIN --> SEARCH
    MAIN --> NLP
    MAIN --> FLOOD
    MAIN --> RATES
    MAIN -- "/admin/stats /admin/retrain" --> USAGE

    SEARCH --> GEO
    SEARCH --> PROV
    SEARCH --> OSM
    SEARCH --> SCORING
    SCORING --> FARE
    PROV --> OSM

    NLP --> TERMS
    NLP --> MODEL
    NLP -- "appends notes" --> TRAINCSV
    TRAIN -- "reads" --> TRAINCSV
    TRAIN -- "saves" --> MODEL
    MAIN -- "retrain" --> TRAIN

    OSM <--> CACHE
    GEO <--> CACHE
    PRE --> OSM
    CACHE --- DB
    USAGE --- DB

    OSM -- "cache miss only" --> OVERPASS
    GEO -- "throttled 1 req/s" --> NOMINATIM
    FLOOD -- "monthly climatology, 30-day TTL" --> METEO
    RATES -- "daily" --> ERAPI
```

## Reading the diagram

- **`main.py`** is the only entry point. It owns rate limits (slowapi), the
  optional Turnstile human check, the `/admin` token gate, and usage logging.
  It parses free-text notes via `nlp.py` and merges the result into the
  search preferences before calling `search.py`.
- **`search.py`** resolves the centre (`geocode.py`), widens the radius from
  the weight profile, gathers listings from `providers/` (OSM always;
  affiliate feeds when keys exist), fetches nearby POIs (`osm.py`), and ranks
  everything with `scoring.py` (which prices commutes via `fare.py`).
- **`nlp.py`** runs the keyword rules from `nlp_terms.csv` and, when
  `nlp_model.joblib` exists, unions in the trained classifier's predictions.
  Every submitted note is appended (weakly labelled) to `nlp_training.csv`;
  `nlp_train.py` refits Naive Bayes vs an MLP on it and saves the winner —
  in batches (CLI or `/admin/retrain`), never per request.
- **`flood.py`** is standalone — only the `/flood-risk` endpoint reaches it.
  It scores season + monthly heavy-rain likelihood + elevation.
- **`apicache.py` / `usage.py`** are the cross-cutting layers: every outbound
  fetch goes through the persistent cache first, and only REAL network calls
  increment the per-provider daily counters shown on `/admin`.
- **`precompute.py`** (run daily) warms the cache for the key Bangkok areas so
  live Overpass calls are the exception, not per-search.
