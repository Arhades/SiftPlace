"""Travelpayouts / Hotellook provider — real hotel prices + affiliate links.

Free affiliate programme: sign up at travelpayouts.com, set
  TRAVELPAYOUTS_TOKEN   — API token
  TRAVELPAYOUTS_MARKER  — your affiliate marker (this is what earns commission)
Skipped gracefully when unset. Uses the Hotellook price-cache API (city-level
query, filtered to the search radius) and builds search.hotellook.com booking
links carrying the marker so every booking is tracked.
"""
from __future__ import annotations

import os

import requests

from providers.base import (ListingsProvider, RawListing, SearchParams,
                            monthly_from_nightly)
from scoring import haversine_m

CACHE_URL = "https://engine.hotellook.com/api/v2/cache.json"
HEADERS = {"User-Agent": "SiftPlace/0.3 (student project)"}


class TravelpayoutsProvider(ListingsProvider):
    name = "hotellook"
    has_prices = True

    def __init__(self):
        self.token = os.environ.get("TRAVELPAYOUTS_TOKEN", "").strip()
        self.marker = os.environ.get("TRAVELPAYOUTS_MARKER", "").strip()

    def available(self) -> bool:
        return bool(self.token and self.marker)

    def _booking_url(self, hotel_id, params: SearchParams) -> str:
        return ("https://search.hotellook.com/"
                f"?hotelId={hotel_id}"
                f"&checkIn={params.check_in.isoformat()}"
                f"&checkOut={params.check_out.isoformat()}"
                f"&adults={params.occupancy}"
                f"&currency=thb&marker={self.marker}")

    def fetch(self, params: SearchParams) -> list[RawListing]:
        if not self.available():
            return []
        try:
            r = requests.get(CACHE_URL, params={
                "location": params.city or f"{params.lat},{params.lon}",
                "checkIn": params.check_in.isoformat(),
                "checkOut": params.check_out.isoformat(),
                "currency": "thb",
                "limit": max(params.limit * 3, 60),  # city-wide; radius-filter below
                "token": self.token,
            }, headers=HEADERS, timeout=20)
            r.raise_for_status()
            items = r.json()
            if not isinstance(items, list):
                return []
        except Exception:
            return []

        out: list[RawListing] = []
        for it in items:
            try:
                geo = ((it.get("location") or {}).get("geo")) or {}
                lat, lon = geo.get("lat"), geo.get("lon")
                name = it.get("hotelName") or ""
                if not name or lat is None or lon is None:
                    continue
                # keep a little slack past the radius; scoring penalises distance
                if haversine_m(params.lat, params.lon, lat, lon) > params.radius_m * 1.3:
                    continue
                total_stay = it.get("priceAvg") or it.get("priceFrom")
                nightly = float(total_stay) / params.nights if total_stay else None
                stars = it.get("stars")
                out.append({
                    "name": name, "lat": float(lat), "lon": float(lon),
                    "type": "hotel",
                    "monthly_thb": monthly_from_nightly(nightly),
                    "nightly_thb": round(nightly) if nightly else None,
                    "url": self._booking_url(it.get("hotelId", ""), params),
                    "provider": self.name,
                    "stars": float(stars) if stars else None,
                    "rating": None, "capacity": None, "min_stay_months": None,
                })
            except Exception:
                continue
            if len(out) >= params.limit:
                break
        return out
