"""Multi-currency FX rates for SiftPlace.

All scoring math runs in ONE internal base currency: THB (listings are Thai).
The user picks a display/input currency; we convert their budget to THB before
scoring, and the frontend converts THB prices back for display using the same
table from GET /rates.

Rates come from a free, key-less source (open.er-api.com, ~daily updates),
cached in-process for a day, with a hardcoded fallback table so the app still
works fully offline / if the source is down. Fallback rates are approximate
(mid-2026) — fine for budgeting, clearly not for settlement.
"""
from __future__ import annotations

import threading
import time

import requests

from usage import count_api_call

BASE_CURRENCY = "THB"

# Currencies the product exposes (selector order). Symbols for the frontend.
SUPPORTED = ["THB", "USD", "EUR", "GBP", "SGD", "JPY", "AUD", "CNY"]
SYMBOLS = {
    "THB": "฿", "USD": "$", "EUR": "€", "GBP": "£",
    "SGD": "S$", "JPY": "¥", "AUD": "A$", "CNY": "CN¥",
}

# Hardcoded fallback: units of each currency per 1 THB (approximate).
FALLBACK_PER_THB = {
    "THB": 1.0,
    "USD": 0.028,
    "EUR": 0.026,
    "GBP": 0.022,
    "SGD": 0.038,
    "JPY": 4.35,
    "AUD": 0.043,
    "CNY": 0.20,
}

RATES_URL = "https://open.er-api.com/v6/latest/THB"
CACHE_TTL_S = 24 * 3600  # refresh daily

_lock = threading.Lock()
_cache: dict = {"fetched_at": 0.0, "rates": None, "source": "fallback"}


def _fetch_live() -> dict[str, float] | None:
    """{currency: units per 1 THB} for the supported set, or None on failure."""
    try:
        count_api_call("er-api")
        r = requests.get(RATES_URL, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("result") != "success":
            return None
        raw = data.get("rates") or {}
        out = {c: float(raw[c]) for c in SUPPORTED if c in raw}
        return out if len(out) == len(SUPPORTED) else None
    except Exception:
        return None


def get_rates() -> dict:
    """Current {currency: per-THB rate} table + metadata; daily cached."""
    with _lock:
        now = time.time()
        if _cache["rates"] is None or now - _cache["fetched_at"] > CACHE_TTL_S:
            live = _fetch_live()
            if live:
                _cache.update(rates=live, fetched_at=now, source="open.er-api.com")
            elif _cache["rates"] is None:
                _cache.update(rates=dict(FALLBACK_PER_THB), fetched_at=now, source="fallback")
            else:
                # keep serving the stale table rather than flapping to fallback
                _cache["fetched_at"] = now
        return {
            "base": BASE_CURRENCY,
            "rates": _cache["rates"],
            "symbols": SYMBOLS,
            "source": _cache["source"],
        }


def to_thb(amount: float, currency: str) -> float:
    """Convert a user-currency amount to THB (the scoring base)."""
    cur = (currency or BASE_CURRENCY).upper()
    if cur == BASE_CURRENCY:
        return amount
    per_thb = get_rates()["rates"].get(cur) or FALLBACK_PER_THB.get(cur)
    if not per_thb:
        return amount  # unknown currency: treat as THB rather than erroring
    return amount / per_thb


def from_thb(amount_thb: float, currency: str) -> float:
    """Convert a THB amount to the user's currency (display helper)."""
    cur = (currency or BASE_CURRENCY).upper()
    if cur == BASE_CURRENCY:
        return amount_thb
    per_thb = get_rates()["rates"].get(cur) or FALLBACK_PER_THB.get(cur)
    return amount_thb * per_thb if per_thb else amount_thb
