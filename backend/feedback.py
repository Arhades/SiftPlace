"""Community listing feedback: "Was this accurate?" votes + scam reports.

One endpoint (POST /feedback) + one SQLite table. Design goals:

* **No accusations, just aggregates** — the UI shows 👍/👎 counts, never the
  report text (reports are for the founder's manual review via /admin/stats).
* **One vote per source per listing** — the primary key is
  (listing_key, ip_hash), so re-voting updates rather than stuffs the box.
  The IP is stored salted-hashed (same scheme as usage.py), never raw.
* **Auto-flag for manual review** — 3+ negatives (and more downs than ups)
  marks the listing `flagged`; the UI shows a caution chip.

Listings have no stable cross-provider ID, so the key is a normalised name +
~11 m coordinate bucket — the same trick merge.py uses for de-duplication.
Everything is fail-safe: feedback must never break search.
"""
from __future__ import annotations

import re
import sqlite3
import threading
import time

from apicache import DB_PATH
from usage import _hash_ip

AUTO_FLAG_NEGATIVES = 3
REPORT_MAX_LEN = 1000

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _connection() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS listing_feedback ("
            " listing_key TEXT NOT NULL,"
            " ip_hash TEXT NOT NULL,"
            " accurate INTEGER NOT NULL,"
            " report TEXT,"
            " ts REAL NOT NULL,"
            " PRIMARY KEY (listing_key, ip_hash))"
        )
        _conn.commit()
    return _conn


def listing_key(name: str, lat: float, lon: float) -> str:
    """Stable-enough identity for a listing across searches: normalised name
    + a ~11 m coordinate bucket."""
    norm = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    return f"{norm}|{round(lat, 4)}|{round(lon, 4)}"


def add_feedback(name: str, lat: float, lon: float, accurate: bool,
                 report: str | None, ip: str) -> dict:
    """Record (or update) one source's vote; returns the fresh aggregate."""
    key = listing_key(name, lat, lon)
    try:
        clean_report = (report or "").strip()[:REPORT_MAX_LEN] or None
        with _lock:
            conn = _connection()
            conn.execute(
                "INSERT OR REPLACE INTO listing_feedback"
                " (listing_key, ip_hash, accurate, report, ts) VALUES (?, ?, ?, ?, ?)",
                (key, _hash_ip(ip or "unknown"), 1 if accurate else 0,
                 clean_report, time.time()),
            )
            conn.commit()
    except Exception:
        pass
    return {"ok": True, "community": get_community(name, lat, lon)}


def _aggregate(rows: list[tuple[int, int]]) -> dict:
    up = sum(n for accurate, n in rows if accurate)
    down = sum(n for accurate, n in rows if not accurate)
    return {"up": up, "down": down,
            "flagged": down >= AUTO_FLAG_NEGATIVES and down > up}


def get_community(name: str, lat: float, lon: float) -> dict:
    """{up, down, flagged} for one listing. Never raises."""
    try:
        key = listing_key(name, lat, lon)
        with _lock:
            conn = _connection()
            rows = conn.execute(
                "SELECT accurate, COUNT(*) FROM listing_feedback"
                " WHERE listing_key = ? GROUP BY accurate", (key,),
            ).fetchall()
        return _aggregate(rows)
    except Exception:
        return {"up": 0, "down": 0, "flagged": False}


def attach_community(results: list[dict]) -> None:
    """Fold each result's aggregate into the dicts (in place, one query total).
    Only called for the current page, so this stays O(page)."""
    try:
        keys = {listing_key(r.get("name", ""), r.get("lat") or 0, r.get("lon") or 0): r
                for r in results if r.get("lat") is not None}
        if not keys:
            return
        placeholders = ",".join("?" for _ in keys)
        with _lock:
            conn = _connection()
            rows = conn.execute(
                f"SELECT listing_key, accurate, COUNT(*) FROM listing_feedback"
                f" WHERE listing_key IN ({placeholders}) GROUP BY listing_key, accurate",
                list(keys),
            ).fetchall()
        by_key: dict[str, list[tuple[int, int]]] = {}
        for key, accurate, n in rows:
            by_key.setdefault(key, []).append((accurate, n))
        for key, result in keys.items():
            if key in by_key:
                result["community"] = _aggregate(by_key[key])
    except Exception:
        pass


def feedback_stats() -> dict:
    """Founder dashboard: how much feedback exists, what's flagged (with the
    report texts for manual review)."""
    try:
        with _lock:
            conn = _connection()
            total = conn.execute("SELECT COUNT(*) FROM listing_feedback").fetchone()[0]
            per_listing = conn.execute(
                "SELECT listing_key,"
                " SUM(accurate), SUM(1 - accurate) FROM listing_feedback"
                " GROUP BY listing_key HAVING SUM(1 - accurate) >= ?",
                (AUTO_FLAG_NEGATIVES,),
            ).fetchall()
            reports = conn.execute(
                "SELECT listing_key, report, ts FROM listing_feedback"
                " WHERE report IS NOT NULL ORDER BY ts DESC LIMIT 50",
            ).fetchall()
        flagged = [{"listing_key": key, "up": int(up or 0), "down": int(down or 0)}
                   for key, up, down in per_listing if (down or 0) > (up or 0)]
        return {"votes_total": total, "flagged_listings": flagged,
                "recent_reports": [
                    {"listing_key": key, "report": report, "ts": ts}
                    for key, report, ts in reports]}
    except Exception:
        return {"votes_total": 0, "flagged_listings": [], "recent_reports": []}
