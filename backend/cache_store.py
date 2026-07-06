"""Small persistent key/value cache with a TTL, backed by SQLite.

Why this exists: SiftPlace leans on free community APIs (Overpass, Nominatim,
Open-Meteo). Re-fetching the same area on every filter tweak would get us
throttled or IP-banned, so outbound clients store their responses here and
reuse them until the entry expires. Being a file on disk (not just in-process
memory), the cache also survives server restarts and can be pre-warmed by
`precompute.py`.

Fail-safe by design: any SQLite problem makes `get` return None (a cache miss)
and `set` do nothing — callers just fall back to a live fetch.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import threading
import time

DB_PATH = pathlib.Path(__file__).parent / "data" / "apicache.db"

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS cache (
               namespace TEXT NOT NULL,
               key       TEXT NOT NULL,
               expires_at REAL NOT NULL,
               value     TEXT NOT NULL,
               PRIMARY KEY (namespace, key)
           )"""
    )
    return conn


def cache_get(namespace: str, key: str):
    """Return the cached JSON value, or None if missing/expired/unreadable."""
    try:
        with _lock, _connect() as conn:
            row = conn.execute(
                "SELECT expires_at, value FROM cache WHERE namespace=? AND key=?",
                (namespace, key),
            ).fetchone()
        if row is None:
            return None
        expires_at, raw = row
        if time.time() > expires_at:
            return None
        return json.loads(raw)
    except Exception:
        return None


def cache_set(namespace: str, key: str, value, ttl_s: float) -> None:
    """Store a JSON-serialisable value for `ttl_s` seconds. Never raises."""
    try:
        raw = json.dumps(value)
        with _lock, _connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (namespace, key, expires_at, value) "
                "VALUES (?, ?, ?, ?)",
                (namespace, key, time.time() + ttl_s, raw),
            )
            # opportunistic cleanup so the file doesn't grow forever
            conn.execute("DELETE FROM cache WHERE expires_at < ?", (time.time(),))
    except Exception:
        pass
