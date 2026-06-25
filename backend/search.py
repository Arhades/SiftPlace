"""Build real, scored listings for ANY city using only free OpenStreetMap data.

Pipeline:
  1. Resolve a search centre (use the user's anchor coords, else geocode the city).
  2. Fetch real lodging candidates near the centre (Overpass).
  3. Fetch real nearby POIs (gyms/supermarkets/transit/...) once per area.
  4. Assemble listings with real proximity distances; price/amenities/reviews unknown.
  5. Score them with the same transparent engine used for the demo.

Honest limitation: OSM gives real names, coordinates and proximity, but no rent
prices, amenities or reviews. Those fields come back unknown (price_known=False)
and must be filled from a commercial listings source later.
"""
from __future__ import annotations

from geocode import geocode
from osm import fetch_accommodations, fetch_pois, nearest, TAGS
from scoring import rank_listings


def build_and_score(prefs: dict, city: str | None = None,
                    radius_m: int = 2500, max_listings: int = 30) -> dict:
    # 1) resolve the search centre
    anchor = prefs.get("anchor")
    if anchor and anchor[0] is not None and anchor[1] is not None:
        centre = (anchor[0], anchor[1])
    elif city:
        g = geocode(city)
        if not g:
            return {"error": f"Could not locate '{city}'.", "results": [], "count": 0}
        centre = (g["lat"], g["lon"])
        prefs["anchor"] = [g["lat"], g["lon"]]
    else:
        return {"error": "Provide a city or anchor coordinates.", "results": [], "count": 0}

    # 2) real lodging candidates
    accoms = fetch_accommodations(centre[0], centre[1], radius_m, max_listings)
    if not accoms:
        return {"error": "No lodging found on OpenStreetMap near that location.",
                "results": [], "count": 0, "centre": list(centre)}

    # 3) real nearby POIs for the wanted kinds (one query per kind over the area)
    wanted = [k for k in prefs.get("nearby", []) if k in TAGS]
    poi_map = fetch_pois(centre[0], centre[1], wanted, radius_m + 1000) if wanted else {}

    # 4) assemble listings — real proximity, unknown price/amenities/reviews
    listings = []
    for a in accoms:
        nb = {}
        for kind in wanted:
            d = nearest(a["lat"], a["lon"], poi_map.get(kind, []))
            if d is not None:
                nb[kind] = d
        listings.append({
            "name": a["name"], "area": city or "", "lat": a["lat"], "lon": a["lon"],
            "price": None, "type": a["type"], "amenities": None, "nearby": nb,
            "street": {"vibe": None, "safety": 3}, "space_sqm": None,
            "reviews": [], "source": "osm",
        })

    # 5) score with the existing engine
    results = rank_listings(listings, prefs, top_n=prefs.get("top_n", 5))
    note = ("Real places and distances from OpenStreetMap. Price, amenities and "
            "reviews are not available from free data — connect a listings source to fill them.")
    return {"error": None, "centre": list(centre), "count": len(results),
            "results": results, "note": note}
