"""Bangkok ride-hailing fare ESTIMATOR (config + helper).

IMPORTANT: Grab/Bolt have no public fare API, so these are *approximate* Bangkok
rates for estimation only. Calibrate against a few real in-app quotes before
trusting comparisons. The apps show fixed upfront prices (distance + time +
surge baked in); these constants reconstruct a comparable total.

Ballpark sources (2025-2026): GrabCar ~75 THB base + ~12.5 THB/km incl. time;
Bolt ~15-25% cheaper than Grab; motorbike taxi ~26-35 THB for a 1-2 km hop.

Drop this in backend/ and call monthly_commute() from the scoring/fare logic.
"""

# ---------- the config: tune these in one place ----------
RATES = {
    "car": {                                  # Grab/Bolt economy car
        "avg_speed_kmh": 16,                  # Bangkok traffic
        "grab": {"base": 45, "per_km": 10.0, "per_min": 1.5, "min": 60}
        #"bolt": {"base": 38, "per_km": 8.5,  "per_min": 1.2, "min": 50},
    },
    "bike": {                                 # motorbike taxi: cheaper, faster
        "avg_speed_kmh": 23,                  # lane-splits the traffic
        "grab": {"base": 15, "per_km": 6.0, "per_min": 0.5, "min": 25}
        #"bolt": {"base": 12, "per_km": 5.5, "per_min": 0.4, "min": 22},
    },
}
SURGE_DEFAULT = 1.0       # peak hours / rain typically 1.2-1.5
WEEKS_PER_MONTH = 4.3


def estimate_one_way(distance_km, mode="car", provider="grab", surge=SURGE_DEFAULT):
    """Return (fare_thb, minutes) for one trip."""
    m = RATES[mode]; r = m[provider]
    minutes = distance_km / m["avg_speed_kmh"] * 60
    fare = (r["base"] + r["per_km"] * distance_km + r["per_min"] * minutes) * surge
    return round(max(fare, r["min"])), round(minutes)


def monthly_commute(distance_km, commute_days, mode="car", provider="grab", surge=SURGE_DEFAULT):
    """Round-trip monthly fare + time for a given commute."""
    one_way, minutes = estimate_one_way(distance_km, mode, provider, surge)
    return {
        "one_way_thb": one_way,
        "one_way_min": minutes,
        "monthly_fare_thb": round(one_way * 2 * commute_days * WEEKS_PER_MONTH),
        "monthly_hours": round(minutes * 2 * commute_days * WEEKS_PER_MONTH / 60, 1),
    }


def both_modes(distance_km, commute_days, provider="grab", surge=SURGE_DEFAULT):
    """Monthly fare + time for BOTH modes, so the UI can compare/toggle car vs bike
    from a single search (the headline trade-off) without recomputing rates client-side."""
    return {
        "car": monthly_commute(distance_km, commute_days, "car", provider, surge),
        "bike": monthly_commute(distance_km, commute_days, "bike", provider, surge),
    }


if __name__ == "__main__":
    for km in (3, 8, 15):
        c = monthly_commute(km, 5, "car"); b = monthly_commute(km, 5, "bike")
        print(f"{km:>2}km @5d/wk  CAR THB{c['monthly_fare_thb']:>5}/mo ({c['monthly_hours']}h)   "
              f"BIKE THB{b['monthly_fare_thb']:>5}/mo ({b['monthly_hours']}h)")
