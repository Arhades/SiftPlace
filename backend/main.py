"""SiftPlace API.

Run locally:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload

Endpoints:
    GET  /health              — sanity check
    GET  /rates               — daily-cached FX table (THB base) for the currency selector
    GET  /geocode?q=...       — place name -> coordinates (Nominatim, Photon fallback)
    GET  /flood-risk?lat=&lon=&months= — per-month flood heuristic (climatology)
    POST /parse               — free-text "anything else?" -> structured demands (NLP)
    POST /chat                — one Sift-mascot turn (Agnes AI -> OpenAI -> nlp.py chain)
    POST /score               — rank the bundled DEMO listings (mock Bangkok data)
    POST /search              — rank REAL listings, PAGINATED (page/page_size -> total)
    POST /feedback            — community "was this accurate?" vote / scam report
    POST /notes/delete        — privacy: remove a stored note from NLP training data
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

import math

from feedback import add_feedback, attach_community, feedback_stats
from flood import flood_risk
from geocode import geocode as geocode_fn
from llm import chat_reply, explain_listings
from models import (ChatRequest, ChatResponse, CityScoreRequest, FeedbackRequest,
                    NoteDeleteRequest, ParseRequest, ScoreRequest, ScoreResponse)
from nlp import (delete_training_examples, model_info, parse_notes, record_note,
                 reload_model)
from rates import get_rates, to_thb
from scoring import rank_listings
from search import build_and_score
from semantic import explain_enabled, semantic_rerank
from usage import get_stats, log_search, reset_network_flag

DATA = pathlib.Path(__file__).parent / "data" / "sample_listings.json"
LISTINGS = json.loads(DATA.read_text(encoding="utf-8"))

app = FastAPI(title="SiftPlace API", version="0.3.0")

# CORS allowlist: the deployed frontend domain(s) plus localhost for dev.
# Override/extend with SIFTPLACE_ALLOWED_ORIGINS (comma-separated). Setting it
# to "*" re-opens everything (dev escape hatch only).
_DEFAULT_ORIGINS = (
    "https://sift-place.vercel.app,"
    "https://www.siftplace.com,"
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:4173,http://localhost:3000"
)
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "SIFTPLACE_ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS,
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

# /search allows page flips (each page is a request, served mostly from cache)
SEARCH_LIMIT = os.environ.get("SIFTPLACE_SEARCH_LIMIT", "30/minute")
PARSE_LIMIT = os.environ.get("SIFTPLACE_PARSE_LIMIT", "30/minute")
GEOCODE_LIMIT = os.environ.get("SIFTPLACE_GEOCODE_LIMIT", "30/minute")
CHAT_LIMIT = os.environ.get("SIFTPLACE_CHAT_LIMIT", "20/minute")
FEEDBACK_LIMIT = os.environ.get("SIFTPLACE_FEEDBACK_LIMIT", "10/minute")

# privacy kill switch: set to disable note storage entirely, whatever clients send
TRAINING_DISABLED = os.environ.get("NLP_TRAINING_DISABLED", "").strip() in ("1", "true", "yes")

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
def flood_endpoint(lat: float, lon: float, months: str | None = None):
    """Per-month flood indicator (open data, cached). `months` is a CSV of
    calendar months 1-12 (the user's stay months); omitted -> next quarter."""
    parsed: list[int] = []
    for part in (months or "").split(","):
        try:
            parsed.append(int(part))
        except ValueError:
            continue
    return flood_risk(lat, lon, parsed or None)


@app.post("/parse")
@rate_limit(PARSE_LIMIT)
def parse_endpoint(request: Request, req: ParseRequest):
    """Turn a free-text note into structured demands (trained model + keyword
    rules). Read-only — live previews are never stored as training data."""
    return parse_notes(req.text)


@app.post("/chat", response_model=ChatResponse)
@rate_limit(CHAT_LIMIT)
def chat_endpoint(request: Request, req: ChatRequest):
    """One turn of the Sift mascot conversation. The LLM chain (Agnes AI ->
    OpenAI -> offline nlp.py rules) replies AND extracts structured demands in
    the same shape /parse returns — the frontend applies them to the filters."""
    require_human(request)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    return chat_reply(messages, req.filters_summary)


@app.post("/feedback")
@rate_limit(FEEDBACK_LIMIT)
def feedback_endpoint(request: Request, req: FeedbackRequest):
    """Community accuracy vote (+ optional scam report) for a listing. One vote
    per source per listing (re-votes update); aggregates come back with search
    results, report texts stay founder-only."""
    return add_feedback(req.name, req.lat, req.lon, req.accurate, req.report,
                        request.client.host if request.client else "unknown")


@app.post("/notes/delete")
@rate_limit(PARSE_LIMIT)
def notes_delete_endpoint(request: Request, req: NoteDeleteRequest):
    """Privacy: delete a previously stored 'Anything else?' note from the NLP
    training data. Matches on the exact text (case-insensitive)."""
    return {"deleted_rows": delete_training_examples(req.text)}


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
    """Find and rank REAL listings for any city (OSM + configured partner feeds).

    Paginated: the full ranked list is computed once per request, but only the
    asked-for page travels back (smaller payload, less rendering). `total`
    tells the client how many matches exist."""
    require_human(request)
    # usage accounting: the fetch modules flip this flag on any real network
    # call; log_search() below then knows cache-hit vs live
    reset_network_flag()

    # everything downstream runs in THB; the user's budget may not
    budget_thb = to_thb(req.budget, req.currency)

    page_size = req.page_size or req.top_n  # old clients keep top_n behaviour

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
        "page_size": page_size,
        "lease_types": list(req.lease_types),
    }

    # NLP: notes + every "Other" free-text answer feed the same parser
    free_text = " . ".join(filter(None, [req.notes, *req.other_terms]))
    parsed = parse_notes(free_text) if free_text.strip() else None
    if parsed:
        _merge_parsed(prefs, parsed)

    # training data only from the explicitly submitted note (deduplicated in
    # record_note), never from previews — and only with the user's consent
    if req.notes and req.notes.strip() and req.allow_training and not TRAINING_DISABLED:
        record_note(req.notes)

    out = build_and_score(prefs, city=req.city,
                          radius_m=req.radius_m, max_listings=req.max_listings,
                          check_in=req.check_in, check_out=req.check_out)

    full = out.get("results", [])
    # optional semantic layer (GMI embeddings): blends vector similarity with
    # the keyword ranking when the request carries free text; no-op otherwise
    if free_text.strip():
        full = semantic_rerank(full, free_text)

    total = len(full)
    total_pages = max(1, math.ceil(total / page_size)) if total else 0
    page = min(req.page, total_pages) if total_pages else 1
    start = (page - 1) * page_size
    page_results = full[start:start + page_size]

    # community accuracy aggregates + (optional) LLM "why it matches" lines,
    # computed for the returned page only
    attach_community(page_results)
    if page_results and free_text.strip() and explain_enabled():
        reasons = explain_listings(free_text, page_results)
        for result in page_results:
            if result.get("name") in reasons:
                result["ai_reason"] = reasons[result["name"]]

    log_search(request.client.host if request.client else "unknown")
    return {"count": len(page_results), "results": page_results,
            "note": out.get("error") or out.get("note"),
            "centre": out.get("centre"), "radius_used": out.get("radius_used"),
            "stay_months": out.get("stay_months"),
            "parsed": parsed, "providers": out.get("providers", []),
            "total": total, "page": page, "page_size": page_size,
            "total_pages": total_pages}


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
    stats["community_feedback"] = feedback_stats()
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
