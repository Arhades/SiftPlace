"""Real place data from OpenStreetMap via the free Overpass API. No API key,
no per-request billing.

What's real here: lodging names + coordinates, and nearby POIs (gyms,
supermarkets, transit, etc.) with real distances. What's NOT available from
OSM: rent prices, amenities, and reviews — those come back unknown and need a
commercial listings source later.

Being a good Overpass citizen (the public endpoint is rate-limited and WILL
block heavy users):

* Every result is stored in the persistent cache (apicache.py, SQLite) with a
  TTL, so repeated and adjacent searches never re-hit Overpass.
* Queries are keyed on a ~1 km coordinate BUCKET and a coarse radius STEP:
  a search anywhere inside the same bucket at any radius up to the step reuses
  one stored query. `precompute.py` warms these entries for the key Bangkok
  areas, so live Overpass calls are the exception, not per-search.
* At most MAX_CONCURRENT_QUERIES Overpass requests run at once.
* Real network calls are counted in usage.py for the founder dashboard.
"""
from __future__ import annotations

import threading

import requests

from apicache import cache_get, cache_set
from scoring import haversine_m
from usage import count_api_call

# Public Overpass mirrors, tried in order. The canonical endpoint rejects some
# networks / the default User-Agent with HTTP 406, and individual mirrors go up
# and down, so we fail over until one answers. All free, no API key.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Overpass requires an identifying User-Agent; the bare requests default is
# blocked (406) by some mirrors. Put a real contact here before any public deploy.
HEADERS = {"User-Agent": "SiftPlace/0.2 (student project; contact: you@example.com)"}

# --- cache tuning ---------------------------------------------------------------
CACHE_TTL_S = 24 * 3600      # POIs/hotels change slowly; refresh daily
# radius is rounded UP to one of these steps so different search radii share
# one cached query per area (10 km also covers the search engine's 9 km cap)
RADIUS_STEPS_M = (4000, 7000, 10000)
# search centres are snapped to ~2 km buckets: big enough that "same area,
# slightly different anchor" (campus vs BTS stop) reuses one cached query
BUCKET_DEG = 0.02
# fetches are centred on the bucket centre, not the exact point; this slack
# guarantees the stored circle still covers a request from the bucket's edge
# (half the bucket diagonal is ~1.6 km at Bangkok's latitude)
BUCKET_SLACK_M = 1600
# how many hotel candidates one cached area query holds (requests then trim)
AREA_ACCOM_CAP = 120

# never hammer Overpass in parallel, whatever the request load is
MAX_CONCURRENT_QUERIES = 2
_query_slots = threading.Semaphore(MAX_CONCURRENT_QUERIES)

# want -> Overpass tag filters (any match counts).
TAGS = {
    "supermarket": ['node["shop"="supermarket"]', 'way["shop"="supermarket"]'],
    "mall": ['node["shop"="mall"]', 'way["shop"="mall"]'],
    "gym": [
        'node["leisure"="fitness_centre"]',
        'node["sport"="fitness"]',
        'node["sport"="martial_arts"]',  # Muay Thai / BJJ gyms
    ],
    "transit": [
        'node["railway"="station"]',
        'node["station"="subway"]',
        'node["public_transport"="station"]',
    ],
    "flea_market": ['node["amenity"="marketplace"]'],
}

# Lodging we can actually find on OSM anywhere in the world.
ACCOM_TAGS = [
    'node["tourism"="hotel"]', 'way["tourism"="hotel"]',
    'node["tourism"="hostel"]', 'way["tourism"="hostel"]',
    'node["tourism"="guest_house"]', 'way["tourism"="guest_house"]',
    'node["tourism"="apartment"]', 'way["tourism"="apartment"]',
]
_TYPE_MAP = {"hotel": "hotel", "hostel": "hostel",
             "guest_house": "hostel", "apartment": "condo"}


# --- cache key helpers -----------------------------------------------------------

def _bucket(lat: float, lon: float) -> tuple[float, float]:
    """~2 km buckets: nearby search centres share one cached Overpass query."""
    return (round(lat / BUCKET_DEG) * BUCKET_DEG, round(lon / BUCKET_DEG) * BUCKET_DEG)


def _cache_radius(radius_m: int) -> int:
    """Round the radius UP to a coarse step (plus bucket slack) so slightly
    different radii don't each trigger their own Overpass query."""
    needed = radius_m + BUCKET_SLACK_M
    for step in RADIUS_STEPS_M:
        if needed <= step:
            return step
    return RADIUS_STEPS_M[-1]


def _cached_at_any_step(key_for_step, min_step: int):
    """Look the query up at its own radius step AND every larger one — a
    bigger cached circle (e.g. warmed by precompute.py) always covers a
    smaller request. Returns (value, step_hit) or (None, min_step)."""
    for step in RADIUS_STEPS_M:
        if step < min_step:
            continue
        value = cache_get(key_for_step(step))
        if value is not None:
            return value, step
    return None, min_step


# --- Overpass client --------------------------------------------------------------

def _post(query: str, timeout: int = 35) -> list:
    """Run an Overpass query against the first mirror that answers; return its
    elements list (empty only if every mirror fails)."""
    with _query_slots:  # cap concurrent Overpass load
        count_api_call("overpass")
        for url in OVERPASS_URLS:
            try:
                resp = requests.post(url, data={"data": query},
                                     headers=HEADERS, timeout=timeout)
                resp.raise_for_status()
                return resp.json().get("elements", [])
            except Exception:
                continue  # mirror down/blocked -> try the next one
    return []


def _coords(element: dict):
    """Pull (lat, lon) from a node, or a way/relation's computed center."""
    lat, lon = element.get("lat"), element.get("lon")
    if lat is None:
        center = element.get("center", {})
        lat, lon = center.get("lat"), center.get("lon")
    return lat, lon


def nearest(plat: float, plon: float, points: list) -> int | None:
    """Metres to the nearest of `points` (each a (lat, lon, name) triple)."""
    best = None
    for point_lat, point_lon, _name in points:
        distance = haversine_m(plat, plon, point_lat, point_lon)
        best = distance if best is None else min(best, distance)
    return round(best) if best is not None else None


# --- public fetchers (cache-first) -------------------------------------------------

def fetch_pois(lat: float, lon: float, kinds: list[str], radius_m: int = 2500) -> dict:
    """One area query per kind -> {kind: [(lat, lon, name), ...]} of real POIs.

    Query once per area, then compute each listing's nearest POI locally — far
    cheaper than a query per listing. Results are cached per (bucket, kind,
    radius step); a cached superset (bigger circle) is fine because callers
    only ever take the nearest point.
    """
    out: dict[str, list] = {}
    for kind in kinds:
        filters = TAGS.get(kind)
        if not filters:
            continue

        bucket_lat, bucket_lon = _bucket(lat, lon)

        def key_for_step(step: int, kind=kind, bucket_lat=bucket_lat,
                         bucket_lon=bucket_lon) -> str:
            return f"overpass:pois:{bucket_lat:.2f}:{bucket_lon:.2f}:{kind}:{step}"

        points, fetch_radius = _cached_at_any_step(key_for_step,
                                                   _cache_radius(radius_m))
        if points is None:
            # fetch around the BUCKET centre so the cached circle matches the
            # key; BUCKET_SLACK_M in the radius covers requests from the edge
            body = "".join(f"{f}(around:{fetch_radius},{bucket_lat},{bucket_lon});"
                           for f in filters)
            points = []
            for element in _post(f"[out:json][timeout:25];({body});out center;"):
                point_lat, point_lon = _coords(element)
                if point_lat is None:
                    continue
                name = (element.get("tags") or {}).get("name", "")
                points.append([point_lat, point_lon, name])
            cache_set(key_for_step(fetch_radius), points, CACHE_TTL_S)
        out[kind] = points
    return out


def fetch_accommodations(lat: float, lon: float, radius_m: int = 2500,
                         limit: int = 30) -> list[dict]:
    """Return real lodging candidates near a point: name, coordinates, type.

    One cached query per (bucket, radius step) holds up to AREA_ACCOM_CAP
    places; each request then filters that list down to its own exact radius
    and limit locally, so repeat/adjacent searches cost zero Overpass calls.
    """
    bucket_lat, bucket_lon = _bucket(lat, lon)

    def key_for_step(step: int) -> str:
        return f"overpass:accom:{bucket_lat:.2f}:{bucket_lon:.2f}:{step}"

    places, fetch_radius = _cached_at_any_step(key_for_step, _cache_radius(radius_m))
    if places is None:
        body = "".join(f"{f}(around:{fetch_radius},{bucket_lat},{bucket_lon});"
                       for f in ACCOM_TAGS)
        places = []
        seen_names = set()
        for element in _post(f"[out:json][timeout:30];({body});"
                             f"out center {AREA_ACCOM_CAP * 2};"):
            tags = element.get("tags") or {}
            name = tags.get("name")
            if not name or name in seen_names:
                continue
            place_lat, place_lon = _coords(element)
            if place_lat is None:
                continue
            seen_names.add(name)
            places.append({"name": name, "lat": place_lat, "lon": place_lon,
                           "type": _TYPE_MAP.get(tags.get("tourism"), "hotel")})
            if len(places) >= AREA_ACCOM_CAP:
                break
        cache_set(key_for_step(fetch_radius), places, CACHE_TTL_S)

    # trim the cached area list to THIS request's exact radius and limit
    within = [place for place in places
              if haversine_m(lat, lon, place["lat"], place["lon"]) <= radius_m]
    return within[:limit]


def nearest_distances(lat: float, lon: float, kinds: list[str],
                      radius_m: int = 1500) -> dict:
    """Convenience: {kind: metres_to_nearest} for a single point. Never raises."""
    pois = fetch_pois(lat, lon, kinds, radius_m)
    out = {}
    for kind, points in pois.items():
        distance = nearest(lat, lon, points)
        if distance is not None:
            out[kind] = distance
    return out
