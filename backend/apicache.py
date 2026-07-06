"""Persistent TTL cache for outbound API results (SQLite, zero dependencies).

Why this exists: SiftPlace leans on free, community-run APIs (Overpass,
Nominatim, Open-Meteo). Re-fetching the same area on every filter change is
the fastest way to get throttled or IP-banned. Modules store their fetched
results here so repeated / adjacent searches are served from disk, and the
free APIs only see genuinely new queries.

The cache survives server restarts (unlike lru_cache) and is shared by the
precompute script, which warms it for the key Bangkok areas.

Usage:
    from apicache import cache_get, cache_set
    hit = cache_get("overpass:pois:...")      # -> parsed JSON value or None
    cache_set(key, value, ttl_s=24 * 3600)    # value must be JSON-serialisable

Never raises: on any SQLite/JSON failure it behaves like a cache miss.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import threading
import time

DB_PATH = pathlib.Path(__file__).parent / "data" / "siftplace.db"

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _connection() -> sqlite3.Connection:
    """Open (once) the shared SQLite file, creating the table on first use."""
    global _conn
    if _conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        # one shared connection guarded by _lock (SQLite objects are not
        # thread-safe by default and FastAPI serves from a thread pool)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS api_cache ("
            " key TEXT PRIMARY KEY,"
            " value TEXT NOT NULL,"
            " expires_at REAL NOT NULL)"
        )
        _conn.commit()
    return _conn


def cache_get(key: str):
    """Return the cached JSON value for `key`, or None if absent/expired."""
    try:
        with _lock:
            conn = _connection()
            row = conn.execute(
                "SELECT value, expires_at FROM api_cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        value_json, expires_at = row
        if time.time() > expires_at:
            return None
        return json.loads(value_json)
    except Exception:
        return None


def cache_set(key: str, value, ttl_s: float) -> None:
    """Store a JSON-serialisable value under `key` for `ttl_s` seconds."""
    try:
        value_json = json.dumps(value)
        expires_at = time.time() + ttl_s
        with _lock:
            conn = _connection()
            conn.execute(
                "INSERT OR REPLACE INTO api_cache (key, value, expires_at)"
                " VALUES (?, ?, ?)",
                (key, value_json, expires_at),
            )
            # opportunistic cleanup so the file doesn't grow forever
            conn.execute("DELETE FROM api_cache WHERE expires_at < ?", (time.time(),))
            conn.commit()
    except Exception:
        pass  # a failed cache write must never break a request
