"""Per-month flood-risk indicator from free open data (Open-Meteo, no API key).

Heuristic, deliberately rough and tunable: Bangkok floods when heavy monsoon
rain meets low-lying ground. Students plan stays months ahead, so instead of a
live weather forecast we score each CALENDAR MONTH the caller asks about
(their stay months, or the next quarter). Points model per month (all
thresholds live in CONFIG):

  Season base ......... Sep/Oct +2 (peak flood window), May-Aug +1 (monsoon)
  Low-lying ground .... elevation <= 4 m above sea level -> +1
  Heavy rain in month . share of the month's days expected to see heavy rain
                        (from monthly climatology), highest matching tier only:
                        >10% -> +1, >33% -> +2, >50% -> +3

  Total points: 0-2 -> low, 3-5 -> moderate, 6+ -> high

"Expected heavy rain in the month" comes from Open-Meteo's historical archive:
we look at the same calendar month over the last few years and count the share
of days whose rainfall crossed the heavy-day threshold. One archive call covers
all 12 months, so a multi-month assessment costs the same as one month. That
climatology barely changes, so it is cached with a long TTL (coarse coordinate
buckets) to respect the free API. If the data is unavailable we fall back to a
season-only estimate.

This is a rough screening signal for students, not a hydrological model.
"""
from __future__ import annotations

import datetime as dt
import threading
import time

import requests

from usage import count_api_call

CONFIG = {
    # what counts as a "heavy rain day" (mm in one day). Open-Meteo's archive
    # is grid-cell reanalysis, which smooths out point downpours: at the Thai
    # Met Dept's 35 mm/day "heavy rain" definition almost NO Bangkok day
    # qualifies, even in September. 10 mm/day on the smoothed grid corresponds
    # to a genuinely wet day and puts Bangkok's Sep peak at ~50% of days —
    # calibrated so the >10/>33/>50% tiers below actually discriminate.
    "heavy_day_mm": 10.0,
    # tiers over the share of the month's days with heavy rain, in percent.
    # Checked top-down; only the HIGHEST matching tier is applied.
    "heavy_pct_tiers": [(50.0, 3), (33.0, 2), (10.0, 1)],
    # how many past years of the same month feed the climatology
    "climatology_years": 5,
    # season: Bangkok's flood-prone months (Sep-Oct peak; May-Aug monsoon build-up)
    "peak_months": (9, 10),
    "monsoon_months": (5, 6, 7, 8),
    "points_peak": 2,
    "points_monsoon": 1,
    # elevation (m): low-lying ground drains poorly
    "low_elevation_m": 4,
    # risk bands over total points
    "points_high": 6,       # 6+   -> high   ("Heavy")
    "points_moderate": 3,   # 3-5  -> moderate ("Medium")
    #                         0-2  -> low    ("Lowest")
    # climatology changes on a decade scale; cache it for a month
    "cache_ttl_s": 30 * 24 * 3600,
}

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

_RISK_RANK = {"low": 0, "moderate": 1, "high": 2}

_lock = threading.Lock()
_cache: dict[tuple, tuple[float, dict]] = {}
# monthly climatology per coordinate bucket: ONE archive call covers all 12
# months, so asking about different months of the same area is free.
_climatology_cache: dict[tuple, tuple[float, dict[int, float] | None]] = {}


def _bucket(lat: float, lon: float) -> tuple:
    """~2 km buckets so nearby listings share one climatology call."""
    return (round(lat * 50) / 50, round(lon * 50) / 50)


def next_quarter_months(today: dt.date | None = None) -> list[int]:
    """The three months of the next full calendar quarter (Jan-Mar, Apr-Jun,
    Jul-Sep, Oct-Dec) after today — the default window when the caller gives
    no stay dates."""
    today = today or dt.date.today()
    start = ((today.month - 1) // 3 + 1) % 4 * 3 + 1
    return [start, start + 1, start + 2]


def _fetch_monthly_heavy_pcts(lat: float, lon: float) -> dict[int, float] | None:
    """{month: share (%) of that month's days with heavy rain}, from the last
    few years of Open-Meteo's historical archive. None if the API fails."""
    years = CONFIG["climatology_years"]
    last_full_year = dt.date.today().year - 1
    start = dt.date(last_full_year - years + 1, 1, 1)
    end = dt.date(last_full_year, 12, 31)
    try:
        count_api_call("open-meteo")
        resp = requests.get(ARCHIVE_URL, params={
            "latitude": lat, "longitude": lon,
            "start_date": start.isoformat(), "end_date": end.isoformat(),
            "daily": "precipitation_sum", "timezone": "auto",
        }, timeout=15)
        resp.raise_for_status()
        daily = resp.json().get("daily") or {}
        dates = daily.get("time") or []
        rain_mm = daily.get("precipitation_sum") or []
    except Exception:
        return None

    days_per_month = {m: 0 for m in range(1, 13)}
    heavy_per_month = {m: 0 for m in range(1, 13)}
    for date_str, rain in zip(dates, rain_mm):
        # dates are ISO "YYYY-MM-DD"; index 5:7 is the month
        month = int(date_str[5:7])
        days_per_month[month] += 1
        if rain is not None and float(rain) >= CONFIG["heavy_day_mm"]:
            heavy_per_month[month] += 1

    if not any(days_per_month.values()):
        return None
    return {m: round(100.0 * heavy_per_month[m] / days_per_month[m], 1)
            for m in range(1, 13) if days_per_month[m] > 0}


def _monthly_heavy_pcts(lat: float, lon: float) -> dict[int, float] | None:
    """Cached lookup of the area's full monthly heavy-rain climatology."""
    key = _bucket(lat, lon)
    now = time.time()
    with _lock:
        hit = _climatology_cache.get(key)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            return hit[1]

    monthly = _fetch_monthly_heavy_pcts(lat, lon)
    with _lock:
        # cache failures too (shorter effective retry via result-cache TTL is
        # unnecessary: one bad window a month is an acceptable trade for never
        # hammering the API when it is down)
        _climatology_cache[key] = (now, monthly)
    return monthly


def _fetch_elevation(lat: float, lon: float) -> float | None:
    try:
        count_api_call("open-meteo")
        resp = requests.get(ELEVATION_URL,
                            params={"latitude": lat, "longitude": lon}, timeout=10)
        resp.raise_for_status()
        elevation = (resp.json().get("elevation") or [None])[0]
        return float(elevation) if elevation is not None else None
    except Exception:
        return None


def _season_points(month: int) -> tuple[int, str | None]:
    """(points, reason) for the calendar month."""
    if month in CONFIG["peak_months"]:
        return (CONFIG["points_peak"],
                "peak rainy season (Sep–Oct) — Bangkok's flood window")
    if month in CONFIG["monsoon_months"]:
        return CONFIG["points_monsoon"], "monsoon season (May–Aug)"
    return 0, None


def _heavy_rain_points(heavy_pct: float) -> tuple[int, str | None]:
    """Points for the expected share of heavy-rain days — highest tier only."""
    for threshold_pct, points in CONFIG["heavy_pct_tiers"]:
        if heavy_pct > threshold_pct:
            reason = (f"~{round(heavy_pct)}% of days typically see heavy rain "
                      f"(≥{round(CONFIG['heavy_day_mm'])} mm/day)")
            return points, reason
    return 0, None


def _assess_month(month: int, heavy_pct: float | None,
                  low_ground: bool) -> dict:
    """Points -> low/moderate/high for ONE calendar month."""
    points = 0
    reasons: list[str] = []

    season_pts, season_reason = _season_points(month)
    points += season_pts
    if season_reason:
        reasons.append(season_reason)

    if low_ground:
        points += 1

    if heavy_pct is not None:
        rain_pts, rain_reason = _heavy_rain_points(heavy_pct)
        points += rain_pts
        if rain_reason:
            reasons.append(rain_reason)

    if points >= CONFIG["points_high"]:
        risk = "high"
    elif points >= CONFIG["points_moderate"]:
        risk = "moderate"
    else:
        risk = "low"
    if not reasons:
        reasons.append("outside the rainy season, little heavy rain expected")

    return {"month": month, "risk": risk,
            "heavy_rain_pct": heavy_pct, "reasons": reasons}


def flood_risk(lat: float, lon: float, months: list[int] | None = None) -> dict:
    """Per-month flood indicator for the given calendar months (the user's stay
    months, or the next quarter when none are given).

    Returns {risk, reasons[], months: [{month, risk, heavy_rain_pct,
             reasons[]}], elevation_m, source} where the top-level risk is the
    WORST month and the top-level reasons are area-wide notes (elevation, data
    gaps). Never raises — on any data failure this degrades to a season-only
    estimate.
    """
    months = [m for m in (months or []) if 1 <= m <= 12]
    months = list(dict.fromkeys(months))[:12] or next_quarter_months()

    cache_key = (_bucket(lat, lon), tuple(months))
    now = time.time()
    with _lock:
        hit = _cache.get(cache_key)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            return hit[1]

    monthly_pcts = _monthly_heavy_pcts(lat, lon)
    elevation = _fetch_elevation(lat, lon)
    low_ground = elevation is not None and elevation <= CONFIG["low_elevation_m"]

    area_reasons: list[str] = []
    if low_ground:
        area_reasons.append(f"low-lying ground (~{round(elevation)} m elevation)")
    if monthly_pcts is None:
        area_reasons.append("seasonal rain data unavailable — season-only estimate")

    month_rows = [
        _assess_month(m, monthly_pcts.get(m) if monthly_pcts else None, low_ground)
        for m in months
    ]
    overall = max((row["risk"] for row in month_rows),
                  key=lambda r: _RISK_RANK[r], default="low")

    out = {
        "risk": overall,
        "reasons": area_reasons,
        "months": month_rows,
        "elevation_m": elevation,
        "source": "open-meteo.com monthly climatology (heuristic indicator, "
                  "not a hydrological model)",
    }
    with _lock:
        _cache[cache_key] = (now, out)
    return out
