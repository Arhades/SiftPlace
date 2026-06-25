"""SiftPlace API — Phase 1.

Run locally:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload

Endpoints:
    GET  /health           — sanity check
    GET  /geocode?q=...    — place name -> coordinates (free OpenStreetMap Nominatim)
    POST /score            — rank the bundled DEMO listings (mock Bangkok data)
    POST /search           — rank REAL OpenStreetMap listings for ANY city

Interactive docs: http://localhost:8000/docs
"""
from __future__ import annotations

import json
import pathlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from geocode import geocode as geocode_fn
from models import CityScoreRequest, ScoreRequest, ScoreResponse
from scoring import rank_listings
from search import build_and_score

DATA = pathlib.Path(__file__).parent / "data" / "sample_listings.json"
LISTINGS = json.loads(DATA.read_text(encoding="utf-8"))

app = FastAPI(title="SiftPlace API", version="0.2.0")

# Allow the local frontend (and anything during dev) to call us.
# TODO: tighten allow_origins to your real domain before any public deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "demo_listings": len(LISTINGS)}


@app.get("/geocode")
def geocode_endpoint(q: str):
    """Resolve a place name to coordinates. Returns {found: false} if not found."""
    g = geocode_fn(q)
    if not g:
        return {"found": False}
    return {"found": True, **g}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    """Rank the bundled DEMO listings against the user's weighted preferences."""
    prefs = {
        "weights": {"cost": req.weights.cost, "location": req.weights.location,
                    "living": req.weights.living},
        "budget": req.budget,
        "anchor": [req.anchor_lat, req.anchor_lon],
        "commute_days": req.commute_days,
        "max_commute": req.max_commute,
        "nearby": req.nearby,
        "vibe": req.vibe,
        "types": req.types,
        "amenities": req.amenities,
    }
    results = rank_listings(LISTINGS, prefs, top_n=req.top_n)
    return {"count": len(results), "results": results}


@app.post("/search", response_model=ScoreResponse)
def search(req: CityScoreRequest):
    """Find and rank REAL OpenStreetMap listings for any city.

    Real names, coordinates and nearby distances; price/amenities/reviews unknown.
    """
    prefs = {
        "weights": {"cost": req.weights.cost, "location": req.weights.location,
                    "living": req.weights.living},
        "budget": req.budget,
        "anchor": ([req.anchor_lat, req.anchor_lon]
                   if req.anchor_lat is not None and req.anchor_lon is not None else None),
        "commute_days": req.commute_days,
        "max_commute": req.max_commute,
        "nearby": req.nearby,
        "vibe": req.vibe,
        "types": req.types,
        "amenities": req.amenities,
        "top_n": req.top_n,
    }
    out = build_and_score(prefs, city=req.city,
                          radius_m=req.radius_m, max_listings=req.max_listings)
    return {"count": out.get("count", 0), "results": out.get("results", []),
            "note": out.get("error") or out.get("note")}
