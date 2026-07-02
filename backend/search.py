"""Build real, scored listings for ANY city from every configured source.

Pipeline:
  1. Resolve a search centre (user's anchor coords, else geocode the city).
  2. Widen the radius adaptively from the weight profile (cost-driven or
     location-flexible users accept a longer commute for a better deal).
  3. Gather listings from every configured provider (OSM always; affiliate
     feeds when their env keys exist), merged + de-duplicated with per-provider
     price offers.
  4. Fetch real nearby POIs (gyms/supermarkets/transit/...) once per area.
  5. Score with the transparent engine, then tag a spread of picks: the top
     match, the best value further out, and the best quality option.

OSM listings stay price_known=False; affiliate listings carry real prices and
booking links.
"""
from __future__ import annotations

import datetime as dt

from geocode import geocode
from osm import fetch_pois, nearest, TAGS
from providers import gather_listings
from providers.base import SearchParams
from scoring import rank_listings

# --- adaptive radius (tune here) ----------------------------------------------
# Widen when cost dominates (hunt cheaper options further out) and when location
# barely matters (the user told us commute distance is negotiable). Keep tight
# when location is the priority.
RADIUS_HARD_CAP_M = 9000
COST_DRIVEN_SHARE = 0.45
LOCATION_FLEXIBLE_SHARE = 0.25
LOCATION_PRIORITY_SHARE = 0.50
WIDEN_FACTOR = 0.7  # each trigger adds +70% of the base radius

RAINY_MONTHS = (9, 10)  # Bangkok flood window (Sep-Oct)


def adaptive_radius(base_m: int, weights: dict) -> int:
    total = sum(weights.values()) or 1
    cost_share = weights.get("cost", 0) / total
    loc_share = weights.get("location", 0) / total
    factor = 1.0
    if cost_share >= COST_DRIVEN_SHARE:
        factor += WIDEN_FACTOR
    if loc_share <= LOCATION_FLEXIBLE_SHARE:
        factor += WIDEN_FACTOR
    if loc_share >= LOCATION_PRIORITY_SHARE:
        factor = 1.0  # location is the point — stay close
    return min(int(base_m * factor), RADIUS_HARD_CAP_M)


def stay_meta(check_in: dt.date | None, check_out: dt.date | None) -> tuple[float | None, bool]:
    """(stay length in months, does the stay overlap the Sep-Oct flood window)."""
    if not check_in or not check_out or check_out <= check_in:
        return None, dt.date.today().month in RAINY_MONTHS
    months = round((check_out - check_in).days / 30.4, 1)
    d = check_in
    while d <= check_out:
        if d.month in RAINY_MONTHS:
            return months, True
        # jump to the 1st of the next month
        d = (d.replace(day=1) + dt.timedelta(days=32)).replace(day=1)
    return months, False


def apply_spread(results: list[dict], top_n: int) -> list[dict]:
    """Return top_n results guaranteed to include the trade-off picks.

    - top_match:    the highest weighted score (rank 1)
    - best_value:   cheapest true monthly cost among priced places (the
                    "cheaper further out" candidate)
    - best_quality: strongest living sub-score / stars (the "worth paying for"
                    candidate)
    If a pick sits outside the top_n it replaces the tail so the user always
    sees the real spread, not a wall of near-identical compromises.
    """
    if not results:
        return results
    top = results[: top_n]

    priced = [r for r in results if r["price_known"] and r.get("true_cost") is not None]
    best_value = min(priced, key=lambda r: r["true_cost"]) if priced else None
    best_quality = max(
        results,
        key=lambda r: (r.get("stars") or 0, r["subscores"].get("living", 0)),
    ) if len(results) > 1 else None

    for pick in (best_value, best_quality):
        if pick is not None and pick not in top and len(top) >= 2:
            top[-1] = pick
    # de-dup in case best_value == best_quality replaced the same slot twice
    seen, unique = set(), []
    for r in top:
        if id(r) not in seen:
            seen.add(id(r))
            unique.append(r)
    top = unique

    top[0]["badge"] = "top_match"
    if best_value is not None and best_value in top and best_value is not top[0]:
        best_value["badge"] = "best_value"
    if (best_quality is not None and best_quality in top
            and best_quality is not top[0] and best_quality.get("badge") is None):
        best_quality["badge"] = "best_quality"
    return top


def build_and_score(prefs: dict, city: str | None = None,
                    radius_m: int = 2500, max_listings: int = 30,
                    check_in: dt.date | None = None,
                    check_out: dt.date | None = None) -> dict:
    # 1) resolve the search centre
    anchor = prefs.get("anchor")
    if anchor and anchor[0] is not None and anchor[1] is not None:
        centre = (anchor[0], anchor[1])
    elif city:
        g = geocode(city, prefer_city=True)
        if not g:
            return {"error": f"Could not locate '{city}'.", "results": [], "count": 0}
        centre = (g["lat"], g["lon"])
        prefs["anchor"] = [g["lat"], g["lon"]]
    else:
        return {"error": "Provide a city or anchor coordinates.", "results": [], "count": 0}

    # 2) widen the search when the weight profile says distance is negotiable
    radius_used = adaptive_radius(radius_m, prefs.get("weights", {}))

    # stay metadata (feeds scoring + the rainy-season flag in the response)
    stay_months, rainy = stay_meta(check_in, check_out)
    prefs["stay_months"] = stay_months

    # 3) listings from every configured source, merged + de-duplicated
    params = SearchParams(centre[0], centre[1], radius_used, max_listings,
                          city=city, check_in=check_in, check_out=check_out,
                          occupancy=prefs.get("occupancy", 1))
    merged, providers = gather_listings(params)
    if not merged:
        return {"error": "No lodging found near that location.",
                "results": [], "count": 0, "centre": list(centre),
                "radius_used": radius_used, "providers": providers,
                "stay_months": stay_months, "rainy_season": rainy}

    # 4) real nearby POIs for the wanted kinds (one query per kind over the area)
    wanted = [k for k in prefs.get("nearby", []) if k in TAGS]
    poi_map = fetch_pois(centre[0], centre[1], wanted, radius_used + 1000) if wanted else {}

    listings = []
    for m in merged:
        nb = {}
        for kind in wanted:
            d = nearest(m["lat"], m["lon"], poi_map.get(kind, []))
            if d is not None:
                nb[kind] = d
        listings.append({
            "name": m["name"], "area": city or "", "lat": m["lat"], "lon": m["lon"],
            "price": m["price"], "type": m["type"], "amenities": None, "nearby": nb,
            "street": {"vibe": None, "safety": 3}, "space_sqm": None,
            "reviews": [], "source": "+".join(m["sources"]),
            "offers": m["offers"], "sources": m["sources"],
            "stars": m.get("stars"), "rating": m.get("rating"),
            "capacity": m.get("capacity"), "min_stay_months": m.get("min_stay_months"),
        })

    # 5) score everything, then guarantee a spread of picks in the top N
    top_n = prefs.get("top_n", 5)
    ranked = rank_listings(listings, prefs, top_n=len(listings))
    results = apply_spread(ranked, top_n)

    priced_n = sum(1 for r in results if r["price_known"])
    if priced_n:
        note = (f"{priced_n} of {len(results)} places carry real prices from partner "
                "feeds; the rest are real OpenStreetMap places without public pricing.")
    else:
        note = ("Real places and distances from OpenStreetMap. Prices appear when a "
                "partner feed (Travelpayouts/Hotelbeds/...) is configured.")
    return {"error": None, "centre": list(centre), "count": len(results),
            "results": results, "note": note, "radius_used": radius_used,
            "providers": providers, "stay_months": stay_months, "rainy_season": rainy}
