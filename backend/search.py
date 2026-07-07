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

from col import estimate as col_estimate
from geocode import geocode
from osm import fetch_pois, nearest, TAGS
from providers import gather_listings
from providers.base import SearchParams
from scoring import rank_listings

# Lease length by place kind, when the source doesn't say. Hotels/hostels are
# bookable month-to-month through the affiliate feeds ("monthly rolling");
# condos' lease terms are landlord-specific -> unknown (confirm with landlord).
LEASE_BY_TYPE = {"hotel": "monthly", "hostel": "monthly"}

# --- adaptive radius (tune here) ----------------------------------------------
# Widen when cost dominates (hunt cheaper options further out) and when location
# barely matters (the user told us commute distance is negotiable). Keep tight
# when location is the priority.
RADIUS_HARD_CAP_M = 9000
COST_DRIVEN_SHARE = 0.45
LOCATION_FLEXIBLE_SHARE = 0.25
LOCATION_PRIORITY_SHARE = 0.50
WIDEN_FACTOR = 0.7  # each trigger adds +70% of the base radius


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


def stay_months_of(check_in: dt.date | None, check_out: dt.date | None) -> float | None:
    """Stay length in months, or None without valid dates. Seasonal rain/flood
    assessment is flood.py's job alone (/flood-risk) — no duplicate boolean here."""
    if not check_in or not check_out or check_out <= check_in:
        return None
    return round((check_out - check_in).days / 30.4, 1)


def apply_spread(results: list[dict], window: int) -> list[dict]:
    """Reorder so the first `window` results (page 1) include the trade-off picks.

    - top_match:    the highest weighted score (rank 1)
    - best_value:   cheapest true monthly cost among priced places (the
                    "cheaper further out" candidate)
    - best_quality: strongest living sub-score / stars (the "worth paying for"
                    candidate)
    If a pick sits outside the window it replaces the window's tail so the
    first page always shows the real spread, not a wall of near-identical
    compromises. Returns the FULL list — displaced results drop back into the
    remainder, so pagination slices it without losing anyone.
    """
    if not results:
        return results
    top = results[: window]

    priced = [result for result in results
              if result["price_known"] and result.get("true_cost") is not None]
    best_value = min(priced, key=lambda result: result["true_cost"]) if priced else None
    best_quality = max(
        results,
        key=lambda result: (result.get("stars") or 0, result["subscores"].get("living", 0)),
    ) if len(results) > 1 else None

    for pick in (best_value, best_quality):
        if pick is not None and pick not in top and len(top) >= 2:
            top[-1] = pick
    # de-dup in case best_value == best_quality replaced the same slot twice
    seen, unique = set(), []
    for result in top:
        if id(result) not in seen:
            seen.add(id(result))
            unique.append(result)
    top = unique

    top[0]["badge"] = "top_match"
    if best_value is not None and best_value in top and best_value is not top[0]:
        best_value["badge"] = "best_value"
    if (best_quality is not None and best_quality in top
            and best_quality is not top[0] and best_quality.get("badge") is None):
        best_quality["badge"] = "best_quality"

    in_window = {id(result) for result in top}
    return top + [result for result in results if id(result) not in in_window]


def build_and_score(prefs: dict, city: str | None = None,
                    radius_m: int = 2500, max_listings: int = 30,
                    check_in: dt.date | None = None,
                    check_out: dt.date | None = None) -> dict:
    # 1) resolve the search centre
    anchor = prefs.get("anchor")
    if anchor and anchor[0] is not None and anchor[1] is not None:
        centre = (anchor[0], anchor[1])
    elif city:
        geo = geocode(city, prefer_city=True)
        if not geo:
            return {"error": f"Could not locate '{city}'.", "results": [], "count": 0}
        centre = (geo["lat"], geo["lon"])
        prefs["anchor"] = [geo["lat"], geo["lon"]]
    else:
        return {"error": "Provide a city or anchor coordinates.", "results": [], "count": 0}

    # 2) widen the search when the weight profile says distance is negotiable
    radius_used = adaptive_radius(radius_m, prefs.get("weights", {}))

    # stay metadata (feeds the min-stay tolerance in scoring)
    stay_months = stay_months_of(check_in, check_out)
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
                "stay_months": stay_months}

    # 4) real nearby POIs for the wanted kinds (one query per kind over the area)
    wanted = [k for k in prefs.get("nearby", []) if k in TAGS]
    poi_map = fetch_pois(centre[0], centre[1], wanted, radius_used + 1000) if wanted else {}

    # lease-type filter: exclude only listings whose KNOWN lease type conflicts
    # with the user's ask; unknown terms pass (the UI says "confirm with landlord")
    wanted_leases = set(prefs.get("lease_types") or [])
    occupancy = max(1, prefs.get("occupancy", 1) or 1)

    listings = []
    for place in merged:
        lease = place.get("lease_type") or LEASE_BY_TYPE.get(place["type"])
        if wanted_leases and lease is not None and lease not in wanted_leases:
            continue
        # metres from this place to the nearest POI of each wanted kind
        nearby_distances = {}
        for kind in wanted:
            metres = nearest(place["lat"], place["lon"], poi_map.get(kind, []))
            if metres is not None:
                nearby_distances[kind] = metres
        listings.append({
            "name": place["name"], "area": city or "",
            "lat": place["lat"], "lon": place["lon"],
            "price": place["price"], "type": place["type"],
            "amenities": None, "nearby": nearby_distances,
            "street": {"vibe": None, "safety": 3}, "space_sqm": None,
            "reviews": [], "source": "+".join(place["sources"]),
            "offers": place["offers"], "sources": place["sources"],
            "stars": place.get("stars"), "rating": place.get("rating"),
            "capacity": place.get("capacity"),
            "min_stay_months": place.get("min_stay_months"),
            "lease_type": lease,
            # "what else you'll spend": rough per-person monthly extras
            "cost_of_living": col_estimate(city, None, occupancy),
        })

    if not listings:
        return {"error": "No listings match that lease type here — try allowing "
                         "more lease options or widening the search.",
                "results": [], "count": 0, "centre": list(centre),
                "radius_used": radius_used, "providers": providers,
                "stay_months": stay_months}

    # 5) score everything, then guarantee a spread of picks on the first page.
    #    The FULL ranked list is returned; main.py slices the requested page.
    window = prefs.get("page_size") or prefs.get("top_n", 5)
    ranked = rank_listings(listings, prefs, top_n=len(listings))
    results = apply_spread(ranked, window)

    priced_n = sum(1 for r in results if r["price_known"])
    if priced_n:
        note = (f"{priced_n} of {len(results)} places carry real prices from partner "
                "feeds; the rest are real OpenStreetMap places without public pricing.")
    else:
        note = ("Real places and distances from OpenStreetMap. Prices appear when a "
                "partner feed (Travelpayouts/Hotelbeds/...) is configured.")
    return {"error": None, "centre": list(centre), "count": len(results),
            "results": results, "note": note, "radius_used": radius_used,
            "providers": providers, "stay_months": stay_months}
