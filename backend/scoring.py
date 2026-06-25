"""SiftPlace scoring engine.

Pure-Python and dependency-free, so it is easy to test, reuse, and reason about.
It turns a user's weighted preferences into a ranked shortlist of places.
Every sub-score is explainable on purpose — SiftPlace's value is transparency,
not a black box.

Listings may be fully-specified (mock/demo data) OR partial (real OpenStreetMap
data has names, coordinates and nearby distances, but NO price, amenities, or
reviews). Missing fields fall back to neutral scores so real places still rank,
and a `price_known` flag tells the UI what's estimated.
"""
from __future__ import annotations

import math
from typing import Any


# --- geo + commute -----------------------------------------------------------

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in metres."""
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def estimate_commute(dist_km: float, days_per_week: int) -> tuple[int, int]:
    """Rough monthly commute estimate -> (minutes_one_way, monthly_cost).

    Deliberately simple and clearly an *estimate*. Replace later with a real
    routing API (e.g. free OpenRouteService) for door-to-door time/cost.
    """
    minutes = (dist_km * 1.3) / 15 * 60          # ~15 km/h effective speed, 1.3 detour factor
    oneway_cost = 20 + 10 * dist_km              # base fare + per-km (currency-agnostic units)
    monthly_cost = oneway_cost * 2 * days_per_week * 4.3
    return round(minutes), round(monthly_cost)


# --- helpers -----------------------------------------------------------------

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def distance_score(metres: float, good: float = 300, bad: float = 2000) -> float:
    """1.0 if within `good` metres, 0.0 beyond `bad`, linear in between."""
    if metres <= good:
        return 1.0
    if metres >= bad:
        return 0.0
    return 1 - (metres - good) / (bad - good)


# --- the engine --------------------------------------------------------------

def score_listing(listing: dict[str, Any], prefs: dict[str, Any]) -> dict[str, Any]:
    """Score one listing against the user's preferences; return a full breakdown.

    Tolerant of missing fields: unknown price/amenities/space/vibe fall back to
    neutral scores so real (OSM) listings still rank fairly.
    """
    # 1) commute + true cost
    dist_km = haversine_m(
        listing["lat"], listing["lon"], prefs["anchor"][0], prefs["anchor"][1]
    ) / 1000
    commute_min, commute_cost = estimate_commute(dist_km, prefs.get("commute_days", 5))

    # 2) cost score — only meaningful if we know the price
    price = listing.get("price")
    price_known = price is not None
    if price_known:
        true_cost = price + commute_cost
        ratio = true_cost / max(prefs["budget"], 1)
        if ratio <= 0.8:
            cost_s = 1.0
        elif ratio >= 1.2:
            cost_s = 0.1
        else:
            cost_s = clamp(1 - (ratio - 0.8) / 0.4 * 0.9, 0.1, 1.0)
    else:
        true_cost = None
        cost_s = 0.5  # neutral — OSM data has no rent price

    # 3) location score — nearby wants + safety + quiet/lively match
    wants = prefs.get("nearby", [])
    nearby = listing.get("nearby", {})
    want_scores = [distance_score(nearby.get(w, 99999)) for w in wants] or [0.5]
    street = listing.get("street", {}) or {}
    safety = street.get("safety", 3)
    vibe = street.get("vibe")
    vibe_match = 1.0 if prefs.get("vibe") and vibe == prefs["vibe"] else 0.0
    location_s = (
        0.7 * (sum(want_scores) / len(want_scores))
        + 0.2 * (safety / 5)
        + 0.1 * vibe_match
    )

    # 4) living score — amenities matched + place type + space
    req_amen = prefs.get("amenities", [])
    amenities = listing.get("amenities")  # None means "unknown" (OSM)
    if amenities is None:
        amen_s = 0.6
    elif req_amen:
        amen_s = sum(1 for a in req_amen if a in amenities) / len(req_amen)
    else:
        amen_s = 0.6
    type_s = 1.0 if listing.get("type") in prefs.get("types", [listing.get("type")]) else 0.3
    space = listing.get("space_sqm")
    space_s = clamp(space / 30) if space else 0.5
    living_s = 0.5 * amen_s + 0.3 * type_s + 0.2 * space_s

    # 5) combine with normalised weights, then apply a commute-tolerance penalty
    w = prefs["weights"]
    total_w = sum(w.values()) or 1
    f = {k: v / total_w for k, v in w.items()}
    tol = 1.0
    max_commute = prefs.get("max_commute", 0)
    if max_commute and commute_min > max_commute:
        tol = clamp(1 - (commute_min - max_commute) / max(max_commute, 1), 0.3, 1.0)
    total = (f["cost"] * cost_s + f["location"] * location_s + f["living"] * living_s) * tol

    met = [w for w in wants if nearby.get(w, 99999) <= 1000]
    return {
        "name": listing["name"],
        "area": listing.get("area", ""),
        "score": round(total * 100),
        "rent": price,
        "true_cost": true_cost,
        "price_known": price_known,
        "commute_min": commute_min,
        "commute_cost": commute_cost,
        "met_nearby": met,
        "vibe": vibe,
        "type": listing.get("type"),
        "matched_amenities": [a for a in req_amen if amenities and a in amenities],
        "subscores": {
            "cost": round(cost_s, 2),
            "location": round(location_s, 2),
            "living": round(living_s, 2),
        },
        "reviews": listing.get("reviews", []),
        "lat": listing["lat"],
        "lon": listing["lon"],
        "source": listing.get("source", "mock"),
    }


def rank_listings(listings: list[dict], prefs: dict, top_n: int = 5) -> list[dict]:
    """Score every listing and return the top N, highest score first."""
    scored = [score_listing(l, prefs) for l in listings]
    scored.sort(key=lambda r: -r["score"])
    return scored[:top_n]
