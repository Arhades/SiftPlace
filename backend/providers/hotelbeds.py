"""Hotelbeds (APItude) provider — real availability + prices, sandbox for now.

Set
  HOTELBEDS_API_KEY
  HOTELBEDS_SECRET
to enable; skipped gracefully otherwise. Every request is signed with
X-Signature = SHA256(apiKey + secret + unixTimestamp) per the APItude docs.
Built against the SANDBOX base URL (api.test.hotelbeds.com); flip
HOTELBEDS_BASE_URL to the live host when the account is certified.

Hotelbeds is a B2B bed bank: prices are bookable through the API, but there is
no public consumer URL to deep-link to, so `url` stays None — the price still
shows in the comparison, marked "via Hotelbeds".
"""
from __future__ import annotations

import hashlib
import os
import time

import requests

from providers.base import (ListingsProvider, RawListing, SearchParams,
                            monthly_from_nightly)

BASE_URL = os.environ.get("HOTELBEDS_BASE_URL", "https://api.test.hotelbeds.com")
AVAIL_PATH = "/hotel-api/1.0/hotels"
_TYPE_HINTS = {"HOSTEL": "hostel", "APART": "condo", "APTHOTEL": "condo"}


class HotelbedsProvider(ListingsProvider):
    name = "hotelbeds"
    has_prices = True

    def __init__(self):
        self.api_key = os.environ.get("HOTELBEDS_API_KEY", "").strip()
        self.secret = os.environ.get("HOTELBEDS_SECRET", "").strip()

    def available(self) -> bool:
        return bool(self.api_key and self.secret)

    def _headers(self) -> dict:
        ts = str(int(time.time()))
        signature = hashlib.sha256(
            (self.api_key + self.secret + ts).encode("utf-8")).hexdigest()
        return {
            "Api-key": self.api_key,
            "X-Signature": signature,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch(self, params: SearchParams) -> list[RawListing]:
        if not self.available():
            return []
        # Hotelbeds caps a stay at ~30 nights per query; price the first month
        # and rank on the monthly-equivalent.
        check_out = params.check_out
        nights = params.nights
        if nights > 30:
            import datetime as dt
            check_out = params.check_in + dt.timedelta(days=30)
            nights = 30
        body = {
            "stay": {"checkIn": params.check_in.isoformat(),
                     "checkOut": check_out.isoformat()},
            "occupancies": [{"rooms": 1, "adults": params.occupancy, "children": 0}],
            "geolocation": {"latitude": params.lat, "longitude": params.lon,
                            "radius": max(1, round(params.radius_m / 1000)),
                            "unit": "km"},
        }
        try:
            r = requests.post(BASE_URL + AVAIL_PATH, json=body,
                              headers=self._headers(), timeout=25)
            r.raise_for_status()
            hotels = ((r.json().get("hotels") or {}).get("hotels")) or []
        except Exception:
            return []

        out: list[RawListing] = []
        for h in hotels[: params.limit]:
            try:
                name = h.get("name")
                lat, lon = h.get("latitude"), h.get("longitude")
                if not name or lat is None or lon is None:
                    continue
                min_rate = h.get("minRate")
                nightly = float(min_rate) / nights if min_rate else None
                category = (h.get("categoryCode") or "").upper()
                out.append({
                    "name": name, "lat": float(lat), "lon": float(lon),
                    "type": _TYPE_HINTS.get(category, "hotel"),
                    "monthly_thb": monthly_from_nightly(nightly),
                    "nightly_thb": round(nightly) if nightly else None,
                    "url": None,  # B2B source: no public booking page to link
                    "provider": self.name,
                    "stars": None, "rating": None,
                    "capacity": None, "min_stay_months": None,
                })
            except Exception:
                continue
        return out
