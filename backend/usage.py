"""Usage accounting: search log + outbound free-API call counters (SQLite).

Two jobs, both feeding the founder dashboard (GET /admin/stats):

1. `log_search(ip)` — one row per /search request with a **hashed** IP (we
   never store raw IPs; the hash is only for spotting spammy sources) and
   whether the request was served from cache or hit the live APIs.

2. `count_api_call(provider)` — per-provider, per-day counters incremented by
   osm.py / geocode.py / flood.py / rates.py **only when a real network call
   happens** (cache hits don't count). This is how the founder sees how close
   the app is to each free service's daily limit before getting blocked.

The "did this request use the network?" signal is a contextvar: main.py resets
it at the start of /search, the fetch modules flip it on any live call, and
log_search reads it afterwards. Contextvars are request-local under FastAPI,
so concurrent requests don't bleed into each other.

Everything here is fail-safe: accounting must never break a user request.
"""
from __future__ import annotations

import contextvars
import datetime as dt
import hashlib
import os
import sqlite3
import threading
import time

from apicache import DB_PATH

# an IP doing more than this many searches in an hour gets flagged on the
# dashboard as a likely spammer/scraper
SPAM_SEARCHES_PER_HOUR = 30

# Daily budgets shown on the dashboard. Nominatim's hard policy is 1 req/s;
# Open-Meteo's free tier is ~10k calls/day; Overpass has no published number,
# so we give ourselves a conservative allowance. Tune freely.
FREE_DAILY_LIMITS = {
    "overpass": 500,
    "nominatim": 1000,
    "photon": 1000,
    "open-meteo": 10000,
    "er-api": 100,
}

# flipped to True by count_api_call() during a request; reset per /search
_network_used: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "network_used", default=False)

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _connection() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS searches ("
            " id INTEGER PRIMARY KEY AUTOINCREMENT,"
            " ts REAL NOT NULL,"
            " day TEXT NOT NULL,"
            " ip_hash TEXT NOT NULL,"
            " cache_hit INTEGER NOT NULL)"
        )
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS api_calls ("
            " day TEXT NOT NULL,"
            " provider TEXT NOT NULL,"
            " count INTEGER NOT NULL DEFAULT 0,"
            " PRIMARY KEY (day, provider))"
        )
        _conn.commit()
    return _conn


def _today() -> str:
    return dt.date.today().isoformat()


def _hash_ip(ip: str) -> str:
    """Salted, truncated hash — enough to group requests by source, useless
    for identifying anyone. Set SIFTPLACE_IP_SALT to rotate it."""
    salt = os.environ.get("SIFTPLACE_IP_SALT", "siftplace-usage")
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:16]


# --- request-scoped "did we hit the network?" flag -----------------------------

def reset_network_flag() -> None:
    """Called by main.py at the start of a /search request."""
    _network_used.set(False)


def count_api_call(provider: str) -> None:
    """Record one REAL outbound call to a free API (never call on a cache hit)."""
    _network_used.set(True)
    try:
        with _lock:
            conn = _connection()
            conn.execute(
                "INSERT INTO api_calls (day, provider, count) VALUES (?, ?, 1)"
                " ON CONFLICT(day, provider) DO UPDATE SET count = count + 1",
                (_today(), provider),
            )
            conn.commit()
    except Exception:
        pass


def log_search(ip: str) -> None:
    """Record one /search request. Reads the network flag set (or not) by the
    fetch modules during this request."""
    try:
        used_network = _network_used.get()
        with _lock:
            conn = _connection()
            conn.execute(
                "INSERT INTO searches (ts, day, ip_hash, cache_hit)"
                " VALUES (?, ?, ?, ?)",
                (time.time(), _today(), _hash_ip(ip or "unknown"),
                 0 if used_network else 1),
            )
            conn.commit()
    except Exception:
        pass


# --- dashboard queries ----------------------------------------------------------

def searches_last_hour_by_ip(ip: str) -> int:
    """How many searches this source made in the last hour (spam throttling)."""
    try:
        with _lock:
            conn = _connection()
            row = conn.execute(
                "SELECT COUNT(*) FROM searches WHERE ip_hash = ? AND ts > ?",
                (_hash_ip(ip or "unknown"), time.time() - 3600),
            ).fetchone()
        return int(row[0])
    except Exception:
        return 0


def get_stats(top_n_ips: int = 10) -> dict:
    """Everything the founder dashboard shows. Never raises."""
    try:
        today = _today()
        with _lock:
            conn = _connection()
            searches_today = conn.execute(
                "SELECT COUNT(*) FROM searches WHERE day = ?", (today,)
            ).fetchone()[0]
            searches_total = conn.execute(
                "SELECT COUNT(*) FROM searches").fetchone()[0]
            cache_hits_today = conn.execute(
                "SELECT COUNT(*) FROM searches WHERE day = ? AND cache_hit = 1",
                (today,),
            ).fetchone()[0]
            hour_ago = time.time() - 3600
            top_ips = conn.execute(
                "SELECT ip_hash, COUNT(*) AS n, MAX(ts) AS last_ts,"
                " SUM(CASE WHEN ts > ? THEN 1 ELSE 0 END) AS last_hour"
                " FROM searches WHERE day = ?"
                " GROUP BY ip_hash ORDER BY n DESC LIMIT ?",
                (hour_ago, today, top_n_ips),
            ).fetchall()
            provider_rows = conn.execute(
                "SELECT provider, count FROM api_calls WHERE day = ?", (today,)
            ).fetchall()

        provider_counts = {provider: count for provider, count in provider_rows}
        providers = []
        for provider, limit in FREE_DAILY_LIMITS.items():
            used = provider_counts.get(provider, 0)
            providers.append({
                "provider": provider, "calls_today": used, "daily_limit": limit,
                "used_pct": round(100 * used / limit, 1) if limit else None,
            })
        # a provider we forgot to list a limit for still shows up
        for provider, used in provider_counts.items():
            if provider not in FREE_DAILY_LIMITS:
                providers.append({"provider": provider, "calls_today": used,
                                  "daily_limit": None, "used_pct": None})

        return {
            "day": today,
            "searches_today": searches_today,
            "searches_total": searches_total,
            "cache_hit_rate_today": (round(cache_hits_today / searches_today, 3)
                                     if searches_today else None),
            "spam_threshold_per_hour": SPAM_SEARCHES_PER_HOUR,
            "top_ips_today": [
                {"ip_hash": ip_hash, "searches": n,
                 "searches_last_hour": int(last_hour or 0),
                 "flagged": (last_hour or 0) > SPAM_SEARCHES_PER_HOUR,
                 "last_seen": dt.datetime.fromtimestamp(last_ts).isoformat(timespec="seconds")}
                for ip_hash, n, last_ts, last_hour in top_ips
            ],
            "api_calls_today": providers,
        }
    except Exception as exc:
        return {"error": f"stats unavailable: {exc.__class__.__name__}"}
