"""Agoda + Expedia providers — wired but dormant until the founder has keys.

Both programmes require account approval before any endpoint answers, so these
are structured, env-keyed skeletons that report unavailable (and are skipped)
until the credentials exist. When keys arrive, fill in fetch() against the
partner docs — the merge/compare pipeline already handles their output shape.

Env vars:
  AGODA_API_KEY, AGODA_SITE_ID          (site id goes into the partner deep link)
  EXPEDIA_API_KEY, EXPEDIA_SHARED_SECRET (EPS Rapid signs with SHA-512(key+secret+ts))
"""
from __future__ import annotations

import os

from providers.base import ListingsProvider, RawListing, SearchParams


class AgodaProvider(ListingsProvider):
    name = "agoda"
    has_prices = True

    def __init__(self):
        self.api_key = os.environ.get("AGODA_API_KEY", "").strip()
        self.site_id = os.environ.get("AGODA_SITE_ID", "").strip()

    def available(self) -> bool:
        # Flip to True (and implement fetch) once the Agoda affiliate account
        # is approved; the lt_v1 affiliate endpoint needs an allow-listed key.
        return False

    def deep_link(self, hotel_id: str | int) -> str:
        """Partner deep link — cid carries the affiliate site id for commission."""
        return (f"https://www.agoda.com/partners/partnersearch.aspx"
                f"?cid={self.site_id}&hid={hotel_id}")

    def fetch(self, params: SearchParams) -> list[RawListing]:
        return []


class ExpediaProvider(ListingsProvider):
    name = "expedia"
    has_prices = True

    def __init__(self):
        self.api_key = os.environ.get("EXPEDIA_API_KEY", "").strip()
        self.shared_secret = os.environ.get("EXPEDIA_SHARED_SECRET", "").strip()

    def available(self) -> bool:
        # EPS Rapid requires a partner contract; enable + implement fetch()
        # (Authorization: EAN APIKey=..,Signature=SHA512(key+secret+ts),timestamp=..)
        # once credentials exist.
        return False

    def fetch(self, params: SearchParams) -> list[RawListing]:
        return []
