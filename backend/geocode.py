"""Server-side geocoding via free, key-less OpenStreetMap services.

Tries Nominatim first (canonical), then falls back to Photon (Komoot). Nominatim
blocks some networks / data-centre IPs outright (HTTP 403/429) while Photon stays
reachable, so the fallback keeps search working everywhere. Results are cached
in-process to respect each service's usage policy. Put a real contact in the
User-Agent below before any public deploy.
"""
from __future__ import annotations

from functools import lru_cache

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_URL = "https://photon.komoot.io/api/"
HEADERS = {"User-Agent": "SiftPlace/0.2 (student project; contact: you@example.com)"}


def _from_nominatim(query: str):
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


def _from_photon(query: str, osm_tag: str | None = None):
    """Photon returns GeoJSON; coordinates are [lon, lat]."""
    params: dict = {"q": query, "limit": 1}
    if osm_tag:
        params["osm_tag"] = osm_tag
    r = requests.get(
        PHOTON_URL,
        params=params,
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        return None
    f = feats[0]
    lon, lat = f["geometry"]["coordinates"][:2]
    p = f.get("properties", {}) or {}
    label = ", ".join(str(p[k]) for k in ("name", "city", "state", "country") if p.get(k))
    return {"lat": float(lat), "lon": float(lon), "label": label}


@lru_cache(maxsize=512)
def geocode(query: str, prefer_city: bool = False):
    """Return {'lat', 'lon', 'label'} for the best match, or None.

    Falls over from Nominatim to Photon so a block on one provider doesn't break
    search. Set `prefer_city=True` when resolving a city *centre*: Photon's public
    instance ranks small same-named villages above metropolises (a bare "Bangkok"
    otherwise lands on a village in Indonesia), so we bias to real cities first,
    then fall back to the unfiltered best match (which covers metropolises like
    Tokyo that OSM tags as a province rather than place=city).
    """
    if not query or not query.strip():
        return None
    # 1) Nominatim — best ranking, but blocked (HTTP 403) on some networks/IPs.
    try:
        result = _from_nominatim(query)
        if result:
            return result
    except Exception:
        pass
    # 2) Photon fallback.
    photon_tags = ["place:city", None] if prefer_city else [None]
    for tag in photon_tags:
        try:
            result = _from_photon(query, tag)
            if result:
                return result
        except Exception:
            continue
    return None
