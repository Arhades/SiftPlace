"""Run every configured provider, then merge + de-duplicate across sources.

The same physical hotel often appears in OSM *and* one or more affiliate feeds
under slightly different names ("Ibis Styles Sukhumvit" vs "ibis Styles Bangkok
Sukhumvit 4"). We match fuzzily on name + coordinates and fold duplicates into
ONE listing carrying every provider's price as an offer — that offer list is
what powers the Skyscanner-style comparison. Priced sources win naming ties,
and price_known stays honest: only listings with at least one real offer are
priced.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from providers.base import ListingsProvider, RawListing, SearchParams
from providers.hotelbeds import HotelbedsProvider
from providers.osm_provider import OSMProvider
from providers.stubs import AgodaProvider, ExpediaProvider
from providers.travelpayouts import TravelpayoutsProvider
from scoring import haversine_m

# Same-place thresholds — tune here.
MATCH_MAX_METRES = 300
MATCH_NAME_RATIO = 0.82

PROVIDER_LABELS = {
    "osm": "OpenStreetMap",
    "hotellook": "Hotellook",
    "hotelbeds": "Hotelbeds",
    "agoda": "Agoda",
    "expedia": "Expedia",
}

_GENERIC = {"hotel", "hostel", "the", "a", "an", "and", "bangkok", "bkk", "at", "de", "la"}


def _providers() -> list[ListingsProvider]:
    # Priced sources first: on a duplicate, the priced record's name/coords win.
    return [
        TravelpayoutsProvider(),
        HotelbedsProvider(),
        AgodaProvider(),
        ExpediaProvider(),
        OSMProvider(),
    ]


def active_providers() -> list[str]:
    return [p.name for p in _providers() if p.available()]


def _norm(name: str) -> str:
    n = re.sub(r"[^a-z0-9 ]", " ", name.lower())
    tokens = [t for t in n.split() if t not in _GENERIC]
    return " ".join(tokens) or n.strip()


def _same_place(a: dict, b: RawListing) -> bool:
    if haversine_m(a["lat"], a["lon"], b["lat"], b["lon"]) > MATCH_MAX_METRES:
        return False
    na, nb = _norm(a["name"]), _norm(b["name"])
    if na == nb:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= MATCH_NAME_RATIO


def _offer(raw: RawListing) -> dict | None:
    if raw.get("monthly_thb") is None:
        return None
    return {
        "provider": raw["provider"],
        "label": PROVIDER_LABELS.get(raw["provider"], raw["provider"]),
        "monthly_thb": raw["monthly_thb"],
        "nightly_thb": raw.get("nightly_thb"),
        "url": raw.get("url"),
    }


def _fold(target: dict, raw: RawListing) -> None:
    """Merge a duplicate raw listing into an already-accepted one."""
    offer = _offer(raw)
    if offer and all(o["provider"] != offer["provider"] for o in target["offers"]):
        target["offers"].append(offer)
    for field in ("stars", "rating", "capacity", "min_stay_months"):
        if target.get(field) is None and raw.get(field) is not None:
            target[field] = raw[field]
    if raw["provider"] not in target["sources"]:
        target["sources"].append(raw["provider"])


def gather_listings(params: SearchParams) -> tuple[list[dict], list[str]]:
    """(merged listings, active provider names).

    Each merged listing: {name, lat, lon, type, price (cheapest monthly THB or
    None), offers (cheapest first), stars, rating, capacity, min_stay_months,
    sources}.
    """
    merged: list[dict] = []
    active: list[str] = []

    for provider in _providers():
        if not provider.available():
            continue
        raws = provider.fetch(params)
        active.append(provider.name)
        for raw in raws:
            dup = next((m for m in merged if _same_place(m, raw)), None)
            if dup is not None:
                _fold(dup, raw)
                continue
            offer = _offer(raw)
            merged.append({
                "name": raw["name"], "lat": raw["lat"], "lon": raw["lon"],
                "type": raw.get("type") or "hotel",
                "offers": [offer] if offer else [],
                "stars": raw.get("stars"), "rating": raw.get("rating"),
                "capacity": raw.get("capacity"),
                "min_stay_months": raw.get("min_stay_months"),
                "sources": [raw["provider"]],
            })

    for m in merged:
        m["offers"].sort(key=lambda o: o["monthly_thb"])
        m["price"] = m["offers"][0]["monthly_thb"] if m["offers"] else None

    # Priced listings first (spec: prefer priced sources), then cap to limit.
    merged.sort(key=lambda m: (m["price"] is None,))
    return merged[: params.limit], active
