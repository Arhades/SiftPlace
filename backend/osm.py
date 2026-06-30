"""Real place data from OpenStreetMap via the free Overpass API. No API key,
no per-request billing.

What's real here: lodging names + coordinates, and nearby POIs (gyms, supermarkets,
transit, etc.) with real distances. What's NOT available from OSM: rent prices,
amenities, and reviews — those come back unknown and need a commercial listings
source later.

Be a good Overpass citizen: query per area (not per listing), cache results, and
keep volume low. The public endpoint is rate-limited.
"""
from __future__ import annotations

import requests

from scoring import haversine_m

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
_TYPE_MAP = {"hotel": "hotel", "hostel": "hostel", "guest_house": "hostel", "apartment": "condo"}


def _post(query: str, timeout: int = 35):
    """Run an Overpass query against the first mirror that answers; return its
    elements list (empty only if every mirror fails)."""
    for url in OVERPASS_URLS:
        try:
            resp = requests.post(url, data={"data": query}, headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            return resp.json().get("elements", [])
        except Exception:
            continue
    return []


def _coords(el):
    """Pull (lat, lon) from a node, or a way/relation's computed center."""
    lat, lon = el.get("lat"), el.get("lon")
    if lat is None:
        c = el.get("center", {})
        lat, lon = c.get("lat"), c.get("lon")
    return lat, lon


def nearest(plat: float, plon: float, points: list[tuple]) -> int | None:
    """Metres to the nearest of `points` (each a (lat, lon, name) tuple)."""
    best = None
    for la, lo, _name in points:
        d = haversine_m(plat, plon, la, lo)
        best = d if best is None else min(best, d)
    return round(best) if best is not None else None


def fetch_pois(lat: float, lon: float, kinds: list[str], radius_m: int = 2500) -> dict:
    """One area query per kind -> {kind: [(lat, lon, name), ...]} of real POIs.

    Query once per area, then compute each listing's nearest POI locally — far
    cheaper than a query per listing.
    """
    out: dict[str, list] = {}
    for kind in kinds:
        filters = TAGS.get(kind)
        if not filters:
            continue
        body = "".join(f"{f}(around:{radius_m},{lat},{lon});" for f in filters)
        pts = []
        for el in _post(f"[out:json][timeout:25];({body});out center;"):
            la, lo = _coords(el)
            if la is None:
                continue
            pts.append((la, lo, (el.get("tags") or {}).get("name", "")))
        out[kind] = pts
    return out


def fetch_accommodations(lat: float, lon: float, radius_m: int = 2500, limit: int = 30) -> list[dict]:
    """Return real lodging candidates near a point: name, coordinates, type."""
    body = "".join(f"{f}(around:{radius_m},{lat},{lon});" for f in ACCOM_TAGS)
    out, seen = [], set()
    for el in _post(f"[out:json][timeout:30];({body});out center {limit * 2};"):
        tags = el.get("tags") or {}
        name = tags.get("name")
        if not name or name in seen:
            continue
        la, lo = _coords(el)
        if la is None:
            continue
        seen.add(name)
        out.append({"name": name, "lat": la, "lon": lo,
                    "type": _TYPE_MAP.get(tags.get("tourism"), "hotel")})
        if len(out) >= limit:
            break
    return out


def nearest_distances(lat: float, lon: float, kinds: list[str], radius_m: int = 1500) -> dict:
    """Convenience: {kind: metres_to_nearest} for a single point. Never raises."""
    pois = fetch_pois(lat, lon, kinds, radius_m)
    out = {}
    for kind, pts in pois.items():
        d = nearest(lat, lon, pts)
        if d is not None:
            out[kind] = d
    return out
