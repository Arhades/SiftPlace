"""Server-side geocoding via free, key-less OpenStreetMap services.

Tries Nominatim first (canonical), then falls back to Photon (Komoot). Nominatim
blocks some networks / data-centre IPs outright (HTTP 403/429) while Photon stays
reachable, so the fallback keeps search working everywhere.

Usage-policy hygiene (Nominatim's published rule is an absolute max of ONE
request per second plus a descriptive User-Agent — violators get IP-banned):

* a per-service throttle enforces >= 1 s between our outbound calls,
* results are cached twice: in-process (lru_cache) AND persistently
  (apicache.py, long TTL — place names don't move), so restarts don't re-ask,
* every real network call is counted in usage.py for the founder dashboard.

Put a real contact in the User-Agent below before any public deploy.
"""
from __future__ import annotations

import threading
import time
from functools import lru_cache

import requests

<<<<<<< Updated upstream
from apicache import cache_get, cache_set
=======
from cache_store import cache_get, cache_set
>>>>>>> Stashed changes
from usage import count_api_call

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_URL = "https://photon.komoot.io/api/"
HEADERS = {"User-Agent": "SiftPlace/0.2 (student project; contact: you@example.com)"}

<<<<<<< Updated upstream
MIN_SECONDS_BETWEEN_CALLS = 1.0   # Nominatim's absolute-max policy; Photon gets
                                  # the same courtesy
CACHE_TTL_S = 30 * 24 * 3600      # geocoding a place name is stable for weeks

=======
# Place names -> coordinates basically never change; keep hits for a month so
# popular queries ("Bangkok", each university) almost never reach the network.
GEOCODE_TTL_S = 30 * 24 * 3600

# Nominatim's usage policy is an absolute max of 1 request/second. Enforce it
# client-side (per provider) so we can't be the reason we get banned.
_MIN_INTERVAL_S = 1.0
>>>>>>> Stashed changes
_throttle_lock = threading.Lock()
_last_call_at: dict[str, float] = {}


<<<<<<< Updated upstream
def _throttle(service: str) -> None:
    """Block until at least MIN_SECONDS_BETWEEN_CALLS since our last call to
    this service. Self-rate-limiting is what keeps us from being IP-banned."""
    with _throttle_lock:
        elapsed = time.time() - _last_call_at.get(service, 0.0)
        wait = MIN_SECONDS_BETWEEN_CALLS - elapsed
        if wait > 0:
            time.sleep(wait)
        _last_call_at[service] = time.time()
=======
def _throttle(provider: str) -> None:
    """Block until at least _MIN_INTERVAL_S has passed since our last call to
    this provider."""
    with _throttle_lock:
        wait = _last_call_at.get(provider, 0.0) + _MIN_INTERVAL_S - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call_at[provider] = time.monotonic()
>>>>>>> Stashed changes


def _from_nominatim(query: str):
    _throttle("nominatim")
    count_api_call("nominatim")
<<<<<<< Updated upstream
    resp = requests.get(
=======
    r = requests.get(
>>>>>>> Stashed changes
        NOMINATIM_URL,
        params={"q": query, "format": "json", "limit": 1},
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return None
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]),
            "label": top.get("display_name", "")}


def _from_photon(query: str, osm_tag: str | None = None):
    """Photon returns GeoJSON; coordinates are [lon, lat]."""
    _throttle("photon")
    count_api_call("photon")
    params: dict = {"q": query, "limit": 1}
    if osm_tag:
        params["osm_tag"] = osm_tag
    _throttle("photon")
    count_api_call("photon")
    resp = requests.get(PHOTON_URL, params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    features = resp.json().get("features", [])
    if not features:
        return None
    feature = features[0]
    lon, lat = feature["geometry"]["coordinates"][:2]
    props = feature.get("properties", {}) or {}
    label = ", ".join(str(props[k]) for k in ("name", "city", "state", "country")
                      if props.get(k))
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
<<<<<<< Updated upstream

    # 0) persistent cache — survives restarts, so common queries ("Bangkok",
    #    each university name) stop costing network calls entirely
    cache_key = f"geocode:{prefer_city}:{query.strip().lower()}"
    cached = cache_get(cache_key)
    if cached is not None:
        # {} marks a cached "not found" so we don't re-ask for typos either
        return cached or None

    result = None
    # 1) Nominatim — best ranking, but blocked (HTTP 403) on some networks/IPs.
    try:
        result = _from_nominatim(query)
=======
    # 0) persistent cache — survives restarts, so popular queries ("Bangkok",
    #    each campus) hit the network roughly once a month per process fleet.
    cache_key = f"{prefer_city}|{query.strip().lower()}"
    cached = cache_get("geocode", cache_key)
    if cached is not None:
        return cached
    # 1) Nominatim — best ranking, but blocked (HTTP 403) on some networks/IPs.
    try:
        result = _from_nominatim(query)
        if result:
            cache_set("geocode", cache_key, result, GEOCODE_TTL_S)
            return result
>>>>>>> Stashed changes
    except Exception:
        result = None
    # 2) Photon fallback.
<<<<<<< Updated upstream
    if result is None:
        photon_tags = ["place:city", None] if prefer_city else [None]
        for tag in photon_tags:
            try:
                result = _from_photon(query, tag)
                if result:
                    break
            except Exception:
                continue

    cache_set(cache_key, result or {}, CACHE_TTL_S)
    return result
=======
    photon_tags = ["place:city", None] if prefer_city else [None]
    for tag in photon_tags:
        try:
            result = _from_photon(query, tag)
            if result:
                cache_set("geocode", cache_key, result, GEOCODE_TTL_S)
                return result
        except Exception:
            continue
    return None
>>>>>>> Stashed changes
