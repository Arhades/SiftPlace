"""Seasonal flood-risk indicator from free open data (Open-Meteo, no API key).

<<<<<<< Updated upstream
Heuristic, deliberately rough and tunable: Bangkok floods when heavy monsoon
rain meets low-lying ground. Points model (all thresholds live in CONFIG):

  Season base ......... Sep/Oct +2 (peak flood window), May-Aug +1 (monsoon)
  Low-lying ground .... elevation <= 4 m above sea level -> +1
  Heavy rain in month . share of the month's days expected to see heavy rain
                        (from monthly climatology), highest matching tier only:
                        >10% -> +1, >33% -> +2, >50% -> +3

  Total points: 0-2 -> low, 3-5 -> moderate, 6+ -> high

"Expected heavy rain in the month" comes from Open-Meteo's historical archive:
we look at the same calendar month over the last few years and count the share
of days whose rainfall crossed the heavy-day threshold. That climatology barely
changes, so it is cached with a long TTL (coarse coordinate buckets) to respect
the free API. If the data is unavailable we fall back to a season-only estimate.

This is a rough screening signal for students, not a hydrological model.
=======
Bangkok floods when heavy monsoon rain meets low-lying ground. Instead of a
7-day forecast (too short to matter for a 3-6 month stay) we now score the
MONTH, blending three signals into simple points:

  * season base:      Sep-Oct (peak flood window)  -> +2
                       May-Aug (monsoon ramp-up)    -> +1
                       any other month              -> +0
  * low-lying ground:  elevation <= 4 m above sea   -> +1
                       (Open-Meteo elevation API; much of Bangkok is ~1-2 m)
  * heavy rain expected this month (Open-Meteo seasonal outlook), measured as
    the share of the month's days with heavy rainfall — highest tier only:
                       > 50% of days -> +3
                       > 33% of days -> +2
                       > 10% of days -> +1

  total points:        0-2 -> "low"   3-5 -> "moderate"   6+ -> "high"

ALL thresholds live in CONFIG below — this is a rough screening signal for
students, not a hydrological model. Fail-safe: if the seasonal outlook is
unavailable we fall back to a season-only estimate, and flood_risk() never
raises.

Results are cached twice (in-process dict + the persistent SQLite cache) on
coarse coordinate buckets with a long TTL, because seasonal data changes
slowly and Open-Meteo's free tier is a shared resource.
>>>>>>> Stashed changes
"""
from __future__ import annotations

import datetime as dt
import threading
import time

import requests

<<<<<<< Updated upstream
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

_lock = threading.Lock()
_cache: dict[tuple, tuple[float, dict]] = {}
# monthly climatology per coordinate bucket: ONE archive call covers all 12
# months, so asking about different months of the same area is free.
_climatology_cache: dict[tuple, tuple[float, dict[int, float] | None]] = {}


def _bucket(lat: float, lon: float) -> tuple:
    """~2 km buckets so nearby listings share one climatology call."""
    return (round(lat * 50) / 50, round(lon * 50) / 50)


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
=======
from cache_store import cache_get, cache_set
from usage import count_api_call

CONFIG = {
    # season base points (Bangkok climatology)
    "peak_months": (9, 10),          # peak rainy season -> +2
    "peak_points": 2,
    "monsoon_months": (5, 6, 7, 8),  # monsoon ramp-up -> +1
    "monsoon_points": 1,
    # elevation (m): low-lying ground drains poorly -> +1
    "low_elevation_m": 4,
    "low_elevation_points": 1,
    # "heavy rain in the month": share of the month's days whose rainfall is
    # at least `heavy_day_mm`, estimated from the seasonal outlook's ensemble.
    "heavy_day_mm": 20,
    # (minimum share, points) — checked top-down, highest matching tier only
    "heavy_share_tiers": ((0.50, 3), (0.33, 2), (0.10, 1)),
    # risk bands over total points
    "moderate_from_points": 3,
    "high_from_points": 6,
    # how many upcoming days to expose for the frontend's little rain chart
    "chart_days": 7,
    # seasonal data changes slowly — cache for a day to spare the free API
    "cache_ttl_s": 24 * 3600,
    "elevation_ttl_s": 30 * 24 * 3600,  # the ground does not move
}

SEASONAL_URL = "https://seasonal-api.open-meteo.com/v1/seasonal"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

_memory_lock = threading.Lock()
_memory_cache: dict[tuple, tuple[float, dict]] = {}


def _bucket(lat: float, lon: float) -> tuple:
    """~2 km buckets so nearby listings share one seasonal-outlook call."""
    return (round(lat * 50) / 50, round(lon * 50) / 50)


# --- outbound fetches (each cached in the persistent store) --------------------

def _fetch_seasonal_daily(lat: float, lon: float) -> dict | None:
    """Daily precipitation from Open-Meteo's seasonal outlook (ECMWF ensemble).

    Returns the raw "daily" block: {"time": [dates...],
    "precipitation_sum": [ensemble mean...], "precipitation_sum_member01": [...], ...}
    or None when the API is unreachable (callers then use season-only scoring).
    """
    cache_key = f"{_bucket(lat, lon)}"
    cached = cache_get("seasonal", cache_key)
    if cached is not None:
        return cached
    try:
        count_api_call("open-meteo")
        response = requests.get(SEASONAL_URL, params={
            "latitude": lat,
            "longitude": lon,
            "daily": "precipitation_sum",
            "forecast_days": 45,  # covers the rest of any month + the chart
        }, timeout=15)
        response.raise_for_status()
        daily = response.json().get("daily") or None
        if daily:
            cache_set("seasonal", cache_key, daily, CONFIG["cache_ttl_s"])
        return daily
>>>>>>> Stashed changes
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


def _heavy_rain_pct(lat: float, lon: float, month: int) -> float | None:
    """Cached lookup of the month's heavy-rain share for this area."""
    key = _bucket(lat, lon)
    now = time.time()
    with _lock:
        hit = _climatology_cache.get(key)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            monthly = hit[1]
            return monthly.get(month) if monthly else None

    monthly = _fetch_monthly_heavy_pcts(lat, lon)
    with _lock:
        # cache failures too (shorter effective retry via result-cache TTL is
        # unnecessary: one bad window a month is an acceptable trade for never
        # hammering the API when it is down)
        _climatology_cache[key] = (now, monthly)
    return monthly.get(month) if monthly else None


def _fetch_elevation(lat: float, lon: float) -> float | None:
    cache_key = f"{_bucket(lat, lon)}"
    cached = cache_get("elevation", cache_key)
    if cached is not None:
        return float(cached)
    try:
        count_api_call("open-meteo")
<<<<<<< Updated upstream
        resp = requests.get(ELEVATION_URL,
                            params={"latitude": lat, "longitude": lon}, timeout=10)
        resp.raise_for_status()
        elevation = (resp.json().get("elevation") or [None])[0]
        return float(elevation) if elevation is not None else None
=======
        response = requests.get(ELEVATION_URL,
                                params={"latitude": lat, "longitude": lon}, timeout=10)
        response.raise_for_status()
        elevation = (response.json().get("elevation") or [None])[0]
        if elevation is None:
            return None
        cache_set("elevation", cache_key, float(elevation), CONFIG["elevation_ttl_s"])
        return float(elevation)
>>>>>>> Stashed changes
    except Exception:
        return None


<<<<<<< Updated upstream
def _season_points(month: int) -> tuple[int, str | None, str]:
    """(points, reason, season label) for the calendar month."""
    if month in CONFIG["peak_months"]:
        return (CONFIG["points_peak"],
                "peak rainy season (Sep–Oct) — Bangkok's flood window", "peak")
    if month in CONFIG["monsoon_months"]:
        return CONFIG["points_monsoon"], "monsoon season (May–Aug)", "monsoon"
    return 0, None, "dry"


def _heavy_rain_points(heavy_pct: float) -> tuple[int, str | None]:
    """Points for the expected share of heavy-rain days — highest tier only."""
    for threshold_pct, points in CONFIG["heavy_pct_tiers"]:
        if heavy_pct > threshold_pct:
            reason = (f"~{round(heavy_pct)}% of days this month typically see "
                      f"heavy rain (≥{round(CONFIG['heavy_day_mm'])} mm/day)")
            return points, reason
    return 0, None


def flood_risk(lat: float, lon: float, month: int | None = None) -> dict:
    """Blend season + monthly heavy-rain likelihood + elevation into a simple
    low / moderate / high indicator.

    Returns {risk, reasons[], season, month, heavy_rain_pct, elevation_m,
             week_rain_mm, max_day_mm, daily, source}. The last three are
    legacy fields kept so older clients don't break (no daily forecast is
    fetched any more). Never raises — on any data failure this degrades to a
    season-only estimate.
    """
    month = month or dt.date.today().month
    cache_key = (_bucket(lat, lon), month)
    now = time.time()
    with _lock:
        hit = _cache.get(cache_key)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            return hit[1]

    heavy_pct = _heavy_rain_pct(lat, lon, month)
    elevation = _fetch_elevation(lat, lon)

    points = 0
    reasons: list[str] = []

    season_pts, season_reason, season = _season_points(month)
    points += season_pts
    if season_reason:
        reasons.append(season_reason)

    if elevation is not None and elevation <= CONFIG["low_elevation_m"]:
        points += 1
        reasons.append(f"low-lying ground (~{round(elevation)} m elevation)")

    if heavy_pct is None:
        reasons.append("seasonal rain data unavailable — season-only estimate")
    else:
        rain_pts, rain_reason = _heavy_rain_points(heavy_pct)
        points += rain_pts
        if rain_reason:
            reasons.append(rain_reason)

    if points >= CONFIG["points_high"]:
        risk = "high"
    elif points >= CONFIG["points_moderate"]:
=======
# --- turning the seasonal ensemble into "share of heavy-rain days" -------------

def _heavy_rain_share(daily: dict, month: int) -> float | None:
    """Estimate which share of this month's days will see heavy rain.

    The seasonal API returns ~50 ensemble members (possible futures). For each
    member we count its heavy days (>= heavy_day_mm) within the current month,
    then average the shares across members. That reads as "the model expects
    heavy rain on X% of the month's days".
    """
    dates = daily.get("time") or []
    month_indexes = []
    for i, iso_date in enumerate(dates):
        try:
            if dt.date.fromisoformat(iso_date).month == month:
                month_indexes.append(i)
        except ValueError:
            continue
    if not month_indexes:
        return None

    member_keys = [k for k in daily
                   if k.startswith("precipitation_sum_member") and daily.get(k)]
    if not member_keys:  # no ensemble? fall back to the mean series
        member_keys = ["precipitation_sum"] if daily.get("precipitation_sum") else []
    if not member_keys:
        return None

    threshold = CONFIG["heavy_day_mm"]
    member_shares = []
    for key in member_keys:
        series = daily[key]
        heavy_days = 0
        counted_days = 0
        for i in month_indexes:
            if i >= len(series) or series[i] is None:
                continue
            counted_days += 1
            if float(series[i]) >= threshold:
                heavy_days += 1
        if counted_days:
            member_shares.append(heavy_days / counted_days)
    if not member_shares:
        return None
    return sum(member_shares) / len(member_shares)


def _chart_days(daily: dict) -> list[dict]:
    """First few days of the outlook for the frontend's rain bars.

    rain_mm is the ensemble MEAN; prob is the share of ensemble members that
    predict a heavy-rain day (a rough "chance of a downpour").
    """
    dates = daily.get("time") or []
    mean_series = daily.get("precipitation_sum") or []
    member_keys = [k for k in daily if k.startswith("precipitation_sum_member")]
    threshold = CONFIG["heavy_day_mm"]

    days = []
    for i, iso_date in enumerate(dates[: CONFIG["chart_days"]]):
        rain_mm = float(mean_series[i] or 0) if i < len(mean_series) else 0.0
        heavy_votes = 0
        voters = 0
        for key in member_keys:
            series = daily.get(key) or []
            if i < len(series) and series[i] is not None:
                voters += 1
                if float(series[i]) >= threshold:
                    heavy_votes += 1
        probability = round(100 * heavy_votes / voters) if voters else 0
        days.append({"date": iso_date, "rain_mm": round(rain_mm, 1), "prob": probability})
    return days


# --- the indicator ---------------------------------------------------------------

def flood_risk(lat: float, lon: float, month: int | None = None) -> dict:
    """Blend season + elevation + the month's heavy-rain outlook into points.

    Returns {risk, reasons[], season, heavy_rain_pct, week_rain_mm, max_day_mm,
             elevation_m, daily: [{date, rain_mm, prob}], source}. `heavy_rain_pct`
    is the share (0-100) of the month's days expected to see heavy rain, or None
    when the seasonal outlook was unavailable. Never raises.
    """
    bucket = _bucket(lat, lon)
    now = time.time()
    with _memory_lock:
        hit = _memory_cache.get(bucket)
        if hit and now - hit[0] < CONFIG["cache_ttl_s"]:
            return hit[1]

    month = month or dt.date.today().month
    seasonal = _fetch_seasonal_daily(lat, lon)
    elevation = _fetch_elevation(lat, lon)

    config = CONFIG
    points = 0
    reasons: list[str] = []

    # 1) season base points (climatology — always available)
    in_peak = month in config["peak_months"]
    in_monsoon = month in config["monsoon_months"]
    if in_peak:
        points += config["peak_points"]
        reasons.append("peak rainy season (Sep–Oct) — Bangkok's flood window")
    elif in_monsoon:
        points += config["monsoon_points"]
        reasons.append("monsoon season (May–Aug)")

    # 2) heavy rain expected this month (seasonal outlook; highest tier only)
    heavy_share = _heavy_rain_share(seasonal, month) if seasonal else None
    if heavy_share is None:
        reasons.append("seasonal rain outlook unavailable — season-only estimate")
    else:
        for min_share, tier_points in config["heavy_share_tiers"]:
            if heavy_share > min_share:
                points += tier_points
                reasons.append(
                    f"heavy rain (≥{config['heavy_day_mm']} mm) expected on "
                    f"~{round(heavy_share * 100)}% of days this month")
                break

    # 3) low-lying ground drains poorly
    if elevation is not None and elevation <= config["low_elevation_m"]:
        points += config["low_elevation_points"]
        reasons.append(f"low-lying ground (~{round(elevation)} m above sea level)")

    if points >= config["high_from_points"]:
        risk = "high"
    elif points >= config["moderate_from_points"]:
>>>>>>> Stashed changes
        risk = "moderate"
    else:
        risk = "low"
    if not reasons:
<<<<<<< Updated upstream
        reasons.append("outside the rainy season, little heavy rain expected")
=======
        reasons.append("dry season — little heavy rain expected this month")

    # keep the pre-seasonal response fields alive for the frontend: a short
    # daily outlook for the rain chart plus its 7-day total / wettest day
    days = _chart_days(seasonal) if seasonal else []
    week_rain = sum(d["rain_mm"] for d in days)
    max_day = max((d["rain_mm"] for d in days), default=0.0)
>>>>>>> Stashed changes

    out = {
        "risk": risk,
        "reasons": reasons,
<<<<<<< Updated upstream
        "season": season,
        "month": month,
        "heavy_rain_pct": heavy_pct,
        "elevation_m": elevation,
        # legacy fields (pre-seasonal model) kept for response-shape compatibility
        "week_rain_mm": 0.0,
        "max_day_mm": 0.0,
        "daily": [],
        "source": "open-meteo.com monthly climatology (heuristic indicator, "
                  "not a hydrological model)",
    }
    with _lock:
        _cache[cache_key] = (now, out)
=======
        "season": "peak" if in_peak else ("monsoon" if in_monsoon else "dry"),
        "heavy_rain_pct": round(heavy_share * 100) if heavy_share is not None else None,
        "week_rain_mm": round(week_rain, 1),
        "max_day_mm": round(max_day, 1),
        "elevation_m": elevation,
        "daily": days,
        "source": "open-meteo.com seasonal outlook (heuristic indicator, not a hydrological model)",
    }
    with _memory_lock:
        _memory_cache[bucket] = (now, out)
>>>>>>> Stashed changes
    return out
