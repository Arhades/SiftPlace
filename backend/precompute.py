"""Warm the persistent API cache for the key Bangkok areas.

Run this periodically (e.g. once a day via cron / Task Scheduler):

    cd backend
    python precompute.py            # warm every area
    python precompute.py --list     # just show the areas

It fetches accommodations + every POI kind for each area below through the
SAME cached code paths the live /search uses (osm.py -> apicache.py), so user
searches near these areas are then served from SQLite and touch Overpass
rarely — the live calls become the exception, not per-search.

Coordinates are hardcoded on purpose: warming the cache must not itself spend
geocoding quota. The radius is the largest step osm.py caches at, so ANY user
radius in these areas hits the same entries.

Scaling note: if volume ever outgrows this, the next steps are self-hosting
Overpass + Nominatim (both have official Docker images) or moving to paid
providers; the affiliate listing feeds also carry their own inventory, which
cuts the Overpass reliance further.
"""
from __future__ import annotations

import sys
import time

from osm import RADIUS_STEPS_M, TAGS, fetch_accommodations, fetch_pois

# name -> (lat, lon). Student-relevant Bangkok anchors: campuses, transit
# hubs, and popular expat/nightlife districts.
BANGKOK_AREAS = {
    "Siam / Chulalongkorn": (13.7383, 100.5300),
    "Sam Yan / Hua Lamphong": (13.7327, 100.5167),
    "Silom / Sathorn": (13.7248, 100.5340),
    "Sukhumvit / Asok": (13.7370, 100.5604),
    "Thonglor": (13.7243, 100.5786),
    "Ekkamai": (13.7196, 100.5854),
    "On Nut": (13.7056, 100.6010),
    "Victory Monument": (13.7649, 100.5383),
    "Ari": (13.7797, 100.5427),
    "Chatuchak / Kasetsart": (13.8283, 100.5599),
    "Ratchada / Huai Khwang": (13.7686, 100.5745),
    "Rattanakosin / Thammasat": (13.7575, 100.4917),
    "Ramkhamhaeng": (13.7559, 100.6210),
    "Bang Na": (13.6681, 100.6046),
}

# largest cached step = one warm covers every user radius in the area
WARM_RADIUS_M = RADIUS_STEPS_M[-1] - 1000  # stays within the top step after slack
PAUSE_BETWEEN_AREAS_S = 2                  # be polite: spread the load out


def warm_area(name: str, lat: float, lon: float) -> None:
    started = time.time()
    accommodations = fetch_accommodations(lat, lon, WARM_RADIUS_M, limit=120)
    pois = fetch_pois(lat, lon, list(TAGS.keys()), WARM_RADIUS_M)
    poi_count = sum(len(points) for points in pois.values())
    print(f"  {name}: {len(accommodations)} places, {poi_count} POIs "
          f"({time.time() - started:.1f}s)")


def main() -> int:
    if "--list" in sys.argv:
        for name, (lat, lon) in BANGKOK_AREAS.items():
            print(f"{name}: {lat}, {lon}")
        return 0

    print(f"Warming {len(BANGKOK_AREAS)} Bangkok areas "
          f"(radius {WARM_RADIUS_M} m, cached 24 h)...")
    for name, (lat, lon) in BANGKOK_AREAS.items():
        try:
            warm_area(name, lat, lon)
        except Exception as exc:  # one bad area must not stop the rest
            print(f"  {name}: FAILED ({exc.__class__.__name__})")
        time.sleep(PAUSE_BETWEEN_AREAS_S)
    print("done — user searches in these areas now serve from the cache.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
