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
    earth_radius_m = 6_371_000.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    # the standard haversine formula
    a = (math.sin(delta_lat / 2) ** 2
         + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    return 2 * earth_radius_m * math.asin(math.sqrt(a))


# Commute time + cost come from the transparent fare model in fare.py
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


def sharpen_weights(weights: dict[str, float], gamma: float = WEIGHT_GAMMA) -> dict[str, float]:
    """Normalise, then push the distribution toward its dominant axes so the
    user's priorities decide the ranking instead of averaging out."""
    total = sum(weights.values()) or 1
    powered = {axis: (value / total) ** gamma for axis, value in weights.items()}
    powered_total = sum(powered.values()) or 1
    return {axis: value / powered_total for axis, value in powered.items()}


def distance_score(metres: float, good: float = 300, bad: float = 2000) -> float:
    """1.0 if within `good` metres, 0.0 beyond `bad`, linear in between."""
    if metres <= good:
        return 1.0
    if metres >= bad:
        return 0.0
    return 1 - (metres - good) / (bad - good)


# --- sub-scores (each returns 0..1) -------------------------------------------

def _cost_score(budget_basis: float | None, budget: float) -> float:
    """How affordable the true monthly cost is against the budget.

    Full marks at <=80% of budget, floor of 0.1 at >=120%, linear in between.
    Unknown price (OSM listings) scores a neutral 0.5 so real places still rank.
    """
    if budget_basis is None:
        return 0.5
    ratio = budget_basis / max(budget, 1)
    if ratio <= 0.8:
        return 1.0
    if ratio >= 1.2:
        return 0.1
    return clamp(1 - (ratio - 0.8) / 0.4 * 0.9, 0.1, 1.0)


def _location_score(listing: dict, prefs: dict) -> float:
    """Nearby wants (70%) + street safety (20%) + quiet/lively match (10%)."""
    wants = prefs.get("nearby", [])
    nearby = listing.get("nearby", {})
    # score each wanted POI kind by distance; no wants -> neutral 0.5
    want_scores = [distance_score(nearby.get(want, 99999)) for want in wants] or [0.5]

    street = listing.get("street", {}) or {}
    safety = street.get("safety", 3)          # 1-5, unknown -> average
    vibe = street.get("vibe")
    vibe_match = 1.0 if prefs.get("vibe") and vibe == prefs["vibe"] else 0.0

    return (
        0.7 * (sum(want_scores) / len(want_scores))
        + 0.2 * (safety / 5)
        + 0.1 * vibe_match
    )


def _living_score(listing: dict, prefs: dict, occupancy: int) -> float:
    """Amenities matched + place type + space (occupancy-aware) + a quality
    signal (stars/guest rating) when an affiliate source has one."""
    # amenities: None means "unknown" (OSM data) -> neutral
    requested = prefs.get("amenities", [])
    amenities = listing.get("amenities")
    if amenities is None:
        amenity_score = 0.6
    elif requested:
        amenity_score = sum(1 for a in requested if a in amenities) / len(requested)
    else:
        amenity_score = 0.6

    # place type: full marks when it's one the user asked for. When the user
    # didn't restrict types, the listing's own type is the default -> full marks.
    accepted_types = prefs.get("types", [listing.get("type")])
    type_score = 1.0 if listing.get("type") in accepted_types else 0.3
    if occupancy > GROUP_SIZE_THRESHOLD:
        # dorm-style places don't fit bigger groups
        type_score *= GROUP_TYPE_PENALTY.get(listing.get("type"), 1.0)

    # space: scale the needed sqm with the group size
    space = listing.get("space_sqm")
    needed_sqm = SPACE_BASE_SQM + SPACE_PER_EXTRA_SQM * (occupancy - 1)
    if space:
        space_score = clamp(space / needed_sqm)
    else:
        space_score = 0.5 if occupancy <= 2 else 0.4

    # quality: hotel stars (out of 5) or guest rating (out of 10) when known
    stars = listing.get("stars")
    rating = listing.get("rating")
    quality = (stars / 5) if stars else ((rating / 10) if rating else None)

    if quality is not None:
        return (0.35 * amenity_score + 0.25 * type_score
                + 0.15 * space_score + 0.25 * clamp(quality))
    return 0.5 * amenity_score + 0.3 * type_score + 0.2 * space_score


def _tolerance_multiplier(commute_min: float, prefs: dict, listing: dict) -> float:
    """Soft penalties: commute longer than the user's cap, and minimum-stay
    requirements the user's stay can't meet (stay data is often missing, so
    these dampen rather than exclude)."""
    multiplier = 1.0
    max_commute = prefs.get("max_commute", 0)
    if max_commute and commute_min > max_commute:
        overshoot = (commute_min - max_commute) / max(max_commute, 1)
        multiplier = clamp(1 - overshoot, 0.3, 1.0)

    stay_months = prefs.get("stay_months")
    min_stay = listing.get("min_stay_months")
    if stay_months and min_stay and min_stay > stay_months:
        multiplier *= STAY_MISMATCH_TOL
    return multiplier


# --- the engine --------------------------------------------------------------

def score_listing(listing: dict[str, Any], prefs: dict[str, Any]) -> dict[str, Any]:
    """Score one listing against the user's preferences; return a full breakdown.

    Tolerant of missing fields: unknown price/amenities/space/vibe fall back to
    neutral scores so real (OSM) listings still rank fairly.
    """
    # 1) commute time + fare for EVERY mode (transparent fare model in fare.py),
    #    then pick the user's chosen mode for ranking. Returning them all lets
    #    the UI flip car/bike/transit/walk instantly without recomputing rates
    #    client-side.
    distance_km = haversine_m(
        listing["lat"], listing["lon"], prefs["anchor"][0], prefs["anchor"][1]
    ) / 1000
    commute_days = prefs.get("commute_days", 5)
    provider = prefs.get("provider", "grab")
    mode = prefs.get("commute_mode", "car")
    value_of_time = prefs.get("value_of_time", 0) or 0

    fares = both_modes(distance_km, commute_days, provider)
    chosen_fare = fares.get(mode, fares["car"])
    commute_min = chosen_fare["one_way_min"]
    one_way_fare = chosen_fare["one_way_thb"]
    monthly_fare = chosen_fare["monthly_fare_thb"]
    monthly_hours = chosen_fare["monthly_hours"]
    commute_cost = monthly_fare  # back-compat field name (= chosen mode's monthly fare)

    # value-of-time: money the user puts on the hours spent commuting (optional)
    time_cost = round(monthly_hours * value_of_time) if value_of_time > 0 else None

    # 2) cost score — true cost = rent + monthly fare; when the user values
    #    their time, fold time_cost in so the ranking weighs hours, not only baht.
    price = listing.get("price")
    price_known = price is not None
    if price_known:
        true_cost = price + monthly_fare
        true_cost_incl_time = true_cost + time_cost if time_cost is not None else None
        budget_basis = true_cost_incl_time if true_cost_incl_time is not None else true_cost
    else:
        true_cost = None
        true_cost_incl_time = None
        budget_basis = None
    cost_score = _cost_score(budget_basis, prefs["budget"])

    # 3) + 4) location and living sub-scores
    occupancy = max(1, prefs.get("occupancy", 1) or 1)
    location_score = _location_score(listing, prefs)
    living_score = _living_score(listing, prefs, occupancy)

    # 5) combine with sharpened weights, then apply tolerance penalties
    weight_share = sharpen_weights(prefs["weights"])
    tolerance = _tolerance_multiplier(commute_min, prefs, listing)
    total = (
        weight_share["cost"] * cost_score
        + weight_share["location"] * location_score
        + weight_share["living"] * living_score
    ) * tolerance

    wants = prefs.get("nearby", [])
    nearby = listing.get("nearby", {})
    met_nearby = [want for want in wants if nearby.get(want, 99999) <= 1000]
    requested_amenities = prefs.get("amenities", [])
    amenities = listing.get("amenities")
    street = listing.get("street", {}) or {}

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
        "met_nearby": met_nearby,
        "vibe": street.get("vibe"),
        "type": listing.get("type"),
        "matched_amenities": [a for a in requested_amenities
                              if amenities and a in amenities],
        "subscores": {
            "cost": round(cost_score, 2),
            "location": round(location_score, 2),
            "living": round(living_score, 2),
        },
        "reviews": listing.get("reviews", []),
        "lat": listing["lat"],
        "lon": listing["lon"],
        "source": listing.get("source", "mock"),
        "offers": listing.get("offers", []),
        "sources": listing.get("sources", []),
        "stars": listing.get("stars"),
        "badge": None,
    }


def rank_listings(listings: list[dict], prefs: dict, top_n: int = 5) -> list[dict]:
    """Score every listing and return the top N, highest score first.

    Places whose known capacity is below the group size are filtered out —
    a 6-person group can't take a 2-person room no matter the score.
    """
    occupancy = max(1, prefs.get("occupancy", 1) or 1)
    eligible = []
    for listing in listings:
        capacity = listing.get("capacity")
        if capacity and capacity < occupancy:
            continue
        eligible.append(listing)

    scored = [score_listing(listing, prefs) for listing in eligible]
    scored.sort(key=lambda result: -result["score"])
    return scored[:top_n]
