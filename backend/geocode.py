"""Server-side geocoding via the free OpenStreetMap Nominatim API.

Turns a place name ("Imperial College London") into coordinates. Cached
in-process to respect Nominatim's usage policy (~1 request/second). For real
production traffic, add a persistent cache and put a real contact in the
User-Agent below — Nominatim requires an identifying User-Agent.
"""
from __future__ import annotations

from functools import lru_cache

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "SiftPlace/0.1 (student project; contact: you@example.com)"}


@lru_cache(maxsize=512)
def geocode(query: str):
    """Return {'lat', 'lon', 'label'} for the best match, or None."""
    if not query or not query.strip():
        return None
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        top = data[0]
        return {"lat": float(top["lat"]), "lon": float(top["lon"]),
                "label": top.get("display_name", "")}
    except Exception:
        return None
