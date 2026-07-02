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

from fare import both_modes


# --- geo + commute -----------------------------------------------------------

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in metres."""
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# Commute time + cost now come from the transparent fare model in fare.py
# (base + per-km + per-min, separate rates for ride-hailing car vs motorbike taxi),
# so the headline trade-off is calibrated to real Bangkok rates, not generic units.


# --- tuning ------------------------------------------------------------------

# >1 sharpens the normalised weights so the profile genuinely dominates ranking:
# a 9/3/2 spread must produce a clearly different shortlist than 3/9/2.
WEIGHT_GAMMA = 1.6

# Occupancy: sqm a solo student needs, plus per extra person. At occupancy 1
# this reproduces the original clamp(space/30).
SPACE_BASE_SQM = 30
SPACE_PER_EXTRA_SQM = 14

# Hostels/dorm-style places fit 1-2 people; bigger groups need real units.
GROUP_TYPE_PENALTY = {"hostel": 0.5}
GROUP_SIZE_THRESHOLD = 2

# Listings whose minimum stay exceeds the user's stay get this multiplier.
STAY_MISMATCH_TOL = 0.7


# --- helpers -----------------------------------------------------------------

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def sharpen_weights(w: dict[str, float], gamma: float = WEIGHT_GAMMA) -> dict[str, float]:
    """Normalise, then push the distribution toward its dominant axes so the
    user's priorities decide the ranking instead of averaging out."""
    total = sum(w.values()) or 1
    powered = {k: (v / total) ** gamma for k, v in w.items()}
    ptotal = sum(powered.values()) or 1
    return {k: v / ptotal for k, v in powered.items()}


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
    # 1) commute time + fare for BOTH modes (transparent fare model in fare.py),
    #    then pick the user's chosen mode for ranking. Returning both lets the UI
    #    flip car<->bike instantly without recomputing rates client-side.
    dist_km = haversine_m(
        listing["lat"], listing["lon"], prefs["anchor"][0], prefs["anchor"][1]
    ) / 1000
    days = prefs.get("commute_days", 5)
    provider = prefs.get("provider", "grab")
    mode = prefs.get("commute_mode", "car")
    vot = prefs.get("value_of_time", 0) or 0
    fares = both_modes(dist_km, days, provider)
    chosen = fares.get(mode, fares["car"])
    commute_min = chosen["one_way_min"]
    one_way_fare = chosen["one_way_thb"]
    monthly_fare = chosen["monthly_fare_thb"]
    monthly_hours = chosen["monthly_hours"]
    commute_cost = monthly_fare  # back-compat field name (= chosen mode's monthly fare)

    # value-of-time: money the user puts on the hours spent commuting (optional)
    time_cost = round(monthly_hours * vot) if vot > 0 else None

    # 2) cost score — only meaningful if we know the price. True cost = rent +
    #    monthly fare; when the user values their time, fold time_cost in so the
    #    ranking weighs hours, not only baht.
    price = listing.get("price")
    price_known = price is not None
    if price_known:
        true_cost = price + monthly_fare
        true_cost_incl_time = true_cost + time_cost if time_cost is not None else None
        budget_basis = true_cost_incl_time if true_cost_incl_time is not None else true_cost
        ratio = budget_basis / max(prefs["budget"], 1)
        if ratio <= 0.8:
            cost_s = 1.0
        elif ratio >= 1.2:
            cost_s = 0.1
        else:
            cost_s = clamp(1 - (ratio - 0.8) / 0.4 * 0.9, 0.1, 1.0)
    else:
        true_cost = None
        true_cost_incl_time = None
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

    # 4) living score — amenities matched + place type + space (occupancy-aware)
    #    + a quality signal (stars/guest rating) when an affiliate source has one
    occupancy = max(1, prefs.get("occupancy", 1) or 1)
    req_amen = prefs.get("amenities", [])
    amenities = listing.get("amenities")  # None means "unknown" (OSM)
    if amenities is None:
        amen_s = 0.6
    elif req_amen:
        amen_s = sum(1 for a in req_amen if a in amenities) / len(req_amen)
    else:
        amen_s = 0.6
    type_s = 1.0 if listing.get("type") in prefs.get("types", [listing.get("type")]) else 0.3
    if occupancy > GROUP_SIZE_THRESHOLD:
        type_s *= GROUP_TYPE_PENALTY.get(listing.get("type"), 1.0)
    space = listing.get("space_sqm")
    needed_sqm = SPACE_BASE_SQM + SPACE_PER_EXTRA_SQM * (occupancy - 1)
    space_s = clamp(space / needed_sqm) if space else (0.5 if occupancy <= 2 else 0.4)
    stars = listing.get("stars")
    rating = listing.get("rating")  # guest rating 0-10
    quality = (stars / 5) if stars else ((rating / 10) if rating else None)
    if quality is not None:
        living_s = 0.35 * amen_s + 0.25 * type_s + 0.15 * space_s + 0.25 * clamp(quality)
    else:
        living_s = 0.5 * amen_s + 0.3 * type_s + 0.2 * space_s

    # 5) combine with sharpened weights, then apply tolerance penalties
    f = sharpen_weights(prefs["weights"])
    tol = 1.0
    max_commute = prefs.get("max_commute", 0)
    if max_commute and commute_min > max_commute:
        tol = clamp(1 - (commute_min - max_commute) / max(max_commute, 1), 0.3, 1.0)
    # prefer places that accept the stay length (soft — data is often missing)
    stay_months = prefs.get("stay_months")
    min_stay = listing.get("min_stay_months")
    if stay_months and min_stay and min_stay > stay_months:
        tol *= STAY_MISMATCH_TOL
    total = (f["cost"] * cost_s + f["location"] * location_s + f["living"] * living_s) * tol

    met = [w for w in wants if nearby.get(w, 99999) <= 1000]
    return {
        "name": listing["name"],
        "area": listing.get("area", ""),
        "score": round(total * 100),
        "rent": price,
        "true_cost": true_cost,
        "true_cost_incl_time": true_cost_incl_time,
        "price_known": price_known,
        "commute_min": commute_min,
        "commute_cost": commute_cost,
        "mode": mode,
        "one_way_fare": one_way_fare,
        "monthly_fare": monthly_fare,
        "monthly_hours": monthly_hours,
        "time_cost": time_cost,
        "fares": fares,
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
        "offers": listing.get("offers", []),
        "sources": listing.get("sources", []),
        "stars": stars,
        "badge": None,
    }


def rank_listings(listings: list[dict], prefs: dict, top_n: int = 5) -> list[dict]:
    """Score every listing and return the top N, highest score first.

    Places whose known capacity is below the group size are filtered out —
    a 6-person group can't take a 2-person room no matter the score.
    """
    occupancy = max(1, prefs.get("occupancy", 1) or 1)
    eligible = [l for l in listings
                if not (l.get("capacity") and l["capacity"] < occupancy)]
    scored = [score_listing(l, prefs) for l in eligible]
    scored.sort(key=lambda r: -r["score"])
    return scored[:top_n]
