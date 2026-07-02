"""ListingsProvider interface + the raw listing shape every source maps into.

A RawListing is a plain dict:
{
  "name": str,
  "lat": float, "lon": float,
  "type": "hotel" | "hostel" | "condo",
  "monthly_thb": int | None,      # monthly-equivalent price in THB (the base currency)
  "nightly_thb": int | None,
  "url": str | None,              # outbound booking link WITH the affiliate id baked in
  "provider": str,                # e.g. "osm", "hotellook", "hotelbeds"
  "stars": float | None,          # source star/collection rating when known
  "rating": float | None,         # guest rating 0-10 when known
  "capacity": int | None,         # max guests when the source says
  "min_stay_months": float | None # when the source says
}

Providers must NEVER raise out of fetch(): a broken/unconfigured source should
degrade to an empty list, not break search. Keys come from env vars only.
"""
from __future__ import annotations

import datetime as dt
from abc import ABC, abstractmethod
from typing import Any, TypeAlias

RawListing: TypeAlias = dict[str, Any]

# Nightly -> monthly-equivalent conversion for long stays.
NIGHTS_PER_MONTH = 30.4


class SearchParams:
    """Everything a provider might need to query its source."""

    def __init__(self, lat: float, lon: float, radius_m: int, limit: int,
                 city: str | None = None,
                 check_in: dt.date | None = None, check_out: dt.date | None = None,
                 occupancy: int = 1):
        self.lat = lat
        self.lon = lon
        self.radius_m = radius_m
        self.limit = limit
        self.city = city
        # Affiliate hotel APIs need concrete dates; default to a 30-night window
        # starting in two weeks so browse-mode (no dates picked) still gets prices.
        today = dt.date.today()
        self.check_in = check_in or (today + dt.timedelta(days=14))
        self.check_out = check_out if (check_out and check_in) else (
            self.check_in + dt.timedelta(days=30))
        self.occupancy = max(1, min(8, occupancy))

    @property
    def nights(self) -> int:
        return max(1, (self.check_out - self.check_in).days)


class ListingsProvider(ABC):
    """One listings source. Implementations map their payloads into RawListings."""

    name: str = "base"
    #: priced sources win de-duplication ties over unpriced ones
    has_prices: bool = False

    @abstractmethod
    def available(self) -> bool:
        """True when the provider is configured (env keys present) and usable."""

    @abstractmethod
    def fetch(self, params: SearchParams) -> list[RawListing]:
        """Return raw listings near the point. Must not raise."""


def monthly_from_nightly(nightly_thb: float | None) -> int | None:
    if nightly_thb is None or nightly_thb <= 0:
        return None
    return round(nightly_thb * NIGHTS_PER_MONTH)
