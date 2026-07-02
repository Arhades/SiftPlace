"""Weather + flood-risk indicator from free open data (Open-Meteo, no API key).

Heuristic, deliberately rough and tunable: Bangkok floods when heavy monsoon
rain meets low-lying ground. We blend
  * forecast rainfall intensity (7-day total + wettest day, Open-Meteo),
  * the Sep-Oct peak rainy-season window (climatology),
  * elevation (Open-Meteo elevation API — much of Bangkok is ~1-2 m above sea level),
into a low / moderate / high indicator. ALL thresholds live in CONFIG below —
this is a rough screening signal for students, not a hydrological model.

Results are cached in-process (coarse coordinate buckets, TTL) to respect the
free API.
"""
from __future__ import annotations

import datetime as dt
import threading
import time

import requests

CONFIG = {
    # forecast thresholds (mm)
    "week_rain_moderate_mm": 60,    # 7-day total that starts to matter
    "week_rain_high_mm": 140,       # 7-day total that means real flood watch
    "day_rain_high_mm": 35,         # any single day above this = intense downpour
    # season: Bangkok's flood-prone months (Sep-Oct peak, monsoon May-Oct)
    "peak_months": (9, 10),
    "monsoon_months": (5, 6, 7, 8, 9, 10),
    # elevation (m): low-lying ground drains poorly
    "low_elevation_m": 4,
    # scoring weights for the blend (points; >=4 high, >=2 moderate)
    "points_high": 4,
    "points_moderate": 2,
    "cache_ttl_s": 3 * 3600,
}

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

_lock = threading.Lock()
_cache: dict[tuple, tuple[float, dict]] = {}


def _bucket(lat: float, lon: float) -> tuple:
    """~2 km buckets so nearby listings share one forecast call."""
    return (round(lat * 50) / 50, round(lon * 50) / 50)


def _fetch_forecast(lat: float, lon: float) -> dict | None:
    try:
        r = requests.get(FORECAST_URL, params={
            "latitude": lat, "longitude": lon,
            "daily": "precipitation_sum,precipitation_probability_max",
            "forecast_days": 7, "timezone": "auto",
        }, timeout=12)
        r.raise_for_status()
        return r.json().get("daily") or None
    except Exception:
        return None


def _fetch_elevation(lat: float, lon: float) -> float | None:
    try:
        r = requests.get(ELEVATION_URL, params={"latitude": lat, "longitude": lon}, timeout=10)
        r.raise_for_status()
        elev = (r.json().get("elevation") or [None])[0]
        return float(elev) if elev is not None else None
    except Exception:
        return None


def flood_risk(lat: float, lon: float, month: int | None = None) -> dict:
    """Blend forecast + season + elevation into a simple indicator.

    Returns {risk, reasons[], season, week_rain_mm, max_day_mm, elevation_m,
             daily: [{date, rain_mm, prob}], source}. Never raises.
    """
    key = _bucket(lat, lon)
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            return hit[1]

    month = month or dt.date.today().month
    daily = _fetch_forecast(lat, lon)
    elevation = _fetch_elevation(lat, lon)

    days: list[dict] = []
    week_rain = 0.0
    max_day = 0.0
    if daily:
        dates = daily.get("time") or []
        sums = daily.get("precipitation_sum") or []
        probs = daily.get("precipitation_probability_max") or []
        for i, d in enumerate(dates):
            rain = float(sums[i] or 0) if i < len(sums) else 0.0
            prob = int(probs[i] or 0) if i < len(probs) else 0
            days.append({"date": d, "rain_mm": round(rain, 1), "prob": prob})
            week_rain += rain
            max_day = max(max_day, rain)

    c = CONFIG
    points = 0
    reasons: list[str] = []

    if daily is None:
        reasons.append("live forecast unavailable — season-only estimate")
    if week_rain >= c["week_rain_high_mm"]:
        points += 3
        reasons.append(f"heavy rain forecast (~{round(week_rain)} mm over 7 days)")
    elif week_rain >= c["week_rain_moderate_mm"]:
        points += 1
        reasons.append(f"wet week ahead (~{round(week_rain)} mm over 7 days)")
    if max_day >= c["day_rain_high_mm"]:
        points += 1
        reasons.append(f"intense downpour expected (up to {round(max_day)} mm in a day)")

    in_peak = month in c["peak_months"]
    in_monsoon = month in c["monsoon_months"]
    if in_peak:
        points += 2
        reasons.append("peak rainy season (Sep–Oct) — Bangkok's flood window")
    elif in_monsoon:
        points += 1
        reasons.append("monsoon season (May–Oct)")

    if elevation is not None and elevation <= c["low_elevation_m"]:
        points += 1
        reasons.append(f"low-lying ground (~{round(elevation)} m elevation)")

    risk = "high" if points >= c["points_high"] else (
        "moderate" if points >= c["points_moderate"] else "low")
    if not reasons:
        reasons.append("dry forecast, outside the rainy season")

    out = {
        "risk": risk,
        "reasons": reasons,
        "season": "peak" if in_peak else ("monsoon" if in_monsoon else "dry"),
        "week_rain_mm": round(week_rain, 1),
        "max_day_mm": round(max_day, 1),
        "elevation_m": elevation,
        "daily": days,
        "source": "open-meteo.com (heuristic indicator, not a hydrological model)",
    }
    with _lock:
        _cache[key] = (now, out)
    return out
