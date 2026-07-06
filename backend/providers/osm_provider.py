"""OpenStreetMap provider — the always-on, key-less source of real places.

Real names, coordinates and types; no prices (price_known stays honest).
Wraps the existing Overpass client in osm.py.
"""
from __future__ import annotations

from osm import fetch_accommodations
from providers.base import ListingsProvider, RawListing, SearchParams


class OSMProvider(ListingsProvider):
    name = "osm"
    has_prices = False

    def available(self) -> bool:
        return True

    def fetch(self, params: SearchParams) -> list[RawListing]:
        try:
            accoms = fetch_accommodations(params.lat, params.lon,
                                          params.radius_m, params.limit)
        except Exception:
            return []
        return [{
            "name": a["name"], "lat": a["lat"], "lon": a["lon"], "type": a["type"],
            "monthly_thb": None, "nightly_thb": None, "url": None,
            "provider": self.name, "stars": None, "rating": None,
            "capacity": None, "min_stay_months": None,
        } for a in accoms]
