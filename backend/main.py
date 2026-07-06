"""SiftPlace API.

Run locally:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload

Endpoints:
    GET  /health              — sanity check
    GET  /rates               — daily-cached FX table (THB base) for the currency selector
    GET  /geocode?q=...       — place name -> coordinates (Nominatim, Photon fallback)
    GET  /flood-risk?lat=&lon= — seasonal heavy-rain climatology + flood heuristic
    POST /parse               — free-text "anything else?" -> structured demands (NLP)
    POST /score               — rank the bundled DEMO listings (mock Bangkok data)
    POST /search              — rank REAL listings (OSM + configured affiliate feeds)
    GET  /admin               — founder dashboard page (asks for the admin token)
    GET  /admin/stats         — usage + API-budget numbers   (ADMIN_TOKEN required)
    POST /admin/retrain       — refit + reload the NLP model (ADMIN_TOKEN required)

No login wall: /search, /parse and /geocode are protected by per-IP rate limits
(slowapi) and an OPTIONAL Cloudflare Turnstile check (enabled by setting
TURNSTILE_SECRET_KEY; the frontend then sends an x-turnstile-token header).

The /admin routes are gated SERVER-SIDE by the ADMIN_TOKEN env var (compared
constant-time). Never gate admin data with a client-side password: anyone can
read page source, so it protects nothing.

Interactive docs: http://localhost:8000/docs
"""
from __future__ import annotations

import json
import os
import pathlib
import secrets

import requests as _requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Load backend/.env (if present) into the process environment BEFORE any
# module below reads os.environ — this is what makes .env.example's
# "copy to .env" instruction actually true. Real env vars set in the shell
# still win; this only fills in what's missing. Safe to call with no .env
# file present (no-op).
load_dotenv()

from flood import flood_risk
from geocode import geocode as geocode_fn
from models import (CityScoreRequest, ParseRequest, ScoreRequest, ScoreResponse)
from nlp import model_info, parse_notes, reload_model
from rates import get_rates, to_thb
from scoring import rank_listings
from search import build_and_score
from usage import get_stats, log_search, reset_network_flag

DATA = pathlib.Path(__file__).parent / "data" / "sample_listings.json"
LISTINGS = json.loads(DATA.read_text(encoding="utf-8"))

app = FastAPI(title="SiftPlace API", version="0.3.0")

# Allow the local frontend (and anything during dev) to call us.
# TODO: tighten allow_origins to your real domain before any public deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- per-IP rate limiting (slowapi). Falls back to no-ops when the package ----
# --- is missing so a bare dev checkout still runs. -----------------------------
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    def rate_limit(spec: str):
        return limiter.limit(spec)
except ImportError:  # pragma: no cover
    def rate_limit(spec: str):  # type: ignore[misc]
        def passthrough(fn):
            return fn
        return passthrough

SEARCH_LIMIT = os.environ.get("SIFTPLACE_SEARCH_LIMIT", "15/minute")
PARSE_LIMIT = os.environ.get("SIFTPLACE_PARSE_LIMIT", "30/minute")
GEOCODE_LIMIT = os.environ.get("SIFTPLACE_GEOCODE_LIMIT", "30/minute")

# --- optional human check (Cloudflare Turnstile) — never a signup gate --------
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET_KEY", "").strip()
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def require_human(request: Request) -> None:
    """403 unless the request carries a valid Turnstile token. No-op when the
    check is not configured (the default)."""
    if not TURNSTILE_SECRET:
        return
    token = request.headers.get("x-turnstile-token", "")
    if not token:
        raise HTTPException(status_code=403, detail="turnstile_required")
    try:
        r = _requests.post(TURNSTILE_VERIFY_URL, data={
            "secret": TURNSTILE_SECRET,
            "response": token,
            "remoteip": request.client.host if request.client else "",
        }, timeout=10)
        if not r.json().get("success"):
            raise HTTPException(status_code=403, detail="turnstile_failed")
    except HTTPException:
        raise
    except Exception:
        # verification service unreachable — fail open rather than block students
        return


@app.get("/health")
def health():
    return {"status": "ok", "demo_listings": len(LISTINGS)}


@app.get("/rates")
def rates_endpoint():
    """FX table (units per 1 THB), refreshed daily, with a hardcoded fallback."""
    return get_rates()


@app.get("/geocode")
@rate_limit(GEOCODE_LIMIT)
def geocode_endpoint(request: Request, q: str):
    """Resolve a place name to coordinates. Returns {found: false} if not found."""
    g = geocode_fn(q)
    if not g:
        return {"found": False}
    return {"found": True, **g}


@app.get("/flood-risk")
def flood_endpoint(lat: float, lon: float):
    """Seasonal heavy-rain likelihood + heuristic flood indicator (open data, cached)."""
    return flood_risk(lat, lon)


@app.post("/parse")
@rate_limit(PARSE_LIMIT)
def parse_endpoint(request: Request, req: ParseRequest):
    """Turn a free-text note into structured demands (trained model + keyword rules)."""
    return parse_notes(req.text)


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
        "commute_mode": req.commute_mode,
        "provider": req.provider,
        "value_of_time": req.value_of_time,
    }
    results = rank_listings(LISTINGS, prefs, top_n=req.top_n)
    return {"count": len(results), "results": results}


def _merge_parsed(prefs: dict, parsed: dict) -> None:
    """Fold NLP-extracted demands from the notes into the search preferences."""
    for bucket in ("amenities", "nearby", "types"):
        for key in parsed.get(bucket, []):
            if key not in prefs[bucket]:
                prefs[bucket].append(key)
    if parsed.get("vibe") and not prefs.get("vibe"):
        prefs["vibe"] = parsed["vibe"]
    for axis, delta in (parsed.get("weight_nudges") or {}).items():
        if delta and axis in prefs["weights"]:
            prefs["weights"][axis] = max(0, min(10, prefs["weights"][axis] + delta))


@app.post("/search", response_model=ScoreResponse)
@rate_limit(SEARCH_LIMIT)
def search(request: Request, req: CityScoreRequest):
    """Find and rank REAL listings for any city (OSM + configured partner feeds)."""
    require_human(request)
    # usage accounting: the fetch modules flip this flag on any real network
    # call; log_search() below then knows cache-hit vs live
    reset_network_flag()

    # everything downstream runs in THB; the user's budget may not
    budget_thb = to_thb(req.budget, req.currency)

    prefs = {
        "weights": {"cost": req.weights.cost, "location": req.weights.location,
                    "living": req.weights.living},
        "budget": budget_thb,
        "anchor": ([req.anchor_lat, req.anchor_lon]
                   if req.anchor_lat is not None and req.anchor_lon is not None else None),
        "commute_days": req.commute_days,
        "max_commute": req.max_commute,
        "nearby": list(req.nearby),
        "vibe": req.vibe,
        "types": list(req.types),
        "amenities": list(req.amenities),
        "commute_mode": req.commute_mode,
        "provider": req.provider,
        "value_of_time": req.value_of_time,
        "occupancy": req.occupancy,
        "top_n": req.top_n,
    }

    # NLP: notes + every "Other" free-text answer feed the same parser
    free_text = " . ".join(filter(None, [req.notes, *req.other_terms]))
    parsed = parse_notes(free_text) if free_text.strip() else None
    if parsed:
        _merge_parsed(prefs, parsed)

    out = build_and_score(prefs, city=req.city,
                          radius_m=req.radius_m, max_listings=req.max_listings,
                          check_in=req.check_in, check_out=req.check_out)
    log_search(request.client.host if request.client else "unknown")
    return {"count": out.get("count", 0), "results": out.get("results", []),
            "note": out.get("error") or out.get("note"),
            "centre": out.get("centre"), "radius_used": out.get("radius_used"),
            "stay_months": out.get("stay_months"),
            "rainy_season": out.get("rainy_season", False),
            "parsed": parsed, "providers": out.get("providers", [])}


# --- founder admin (server-side ADMIN_TOKEN gate) -------------------------------

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()
ADMIN_HTML = pathlib.Path(__file__).parent / "admin.html"


def require_admin(request: Request) -> None:
    """403 unless the request carries the ADMIN_TOKEN. The check runs on the
    BACKEND with a constant-time compare — a client-side password would be
    readable by anyone in the page source and protect nothing."""
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=403,
                            detail="admin disabled — set ADMIN_TOKEN in backend/.env")
    supplied = request.headers.get("authorization", "")
    if supplied.lower().startswith("bearer "):
        supplied = supplied[7:]
    if not secrets.compare_digest(supplied.strip(), ADMIN_TOKEN):
        raise HTTPException(status_code=403, detail="bad admin token")


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_page():
    """The founder dashboard shell — a public, static page holding no data.
    Its JavaScript asks for the token and calls /admin/stats with it."""
    try:
        return ADMIN_HTML.read_text(encoding="utf-8")
    except FileNotFoundError:
        return HTMLResponse("admin.html missing", status_code=404)


@app.get("/admin/stats")
def admin_stats(request: Request):
    """Usage + free-API budget numbers for the founder (see usage.py)."""
    require_admin(request)
    stats = get_stats()
    stats["nlp_model"] = model_info()
    return stats


@app.post("/admin/retrain")
def admin_retrain(request: Request):
    """Refit the NLP classifier on all accumulated notes and hot-reload it.
    Batch retraining on demand — never per request."""
    require_admin(request)
    from nlp_train import train_and_save
    result = train_and_save(verbose=False)
    result["model_reloaded"] = reload_model() if result.get("trained") else False
    return result
