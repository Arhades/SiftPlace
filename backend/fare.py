"""Bangkok ride-hailing fare ESTIMATOR (config + helpers).

IMPORTANT: Grab/Bolt have no public fare API, so these are *approximate* Bangkok
rates for estimation only. Calibrate against a few real in-app quotes before
trusting comparisons. The apps show fixed upfront prices (distance + time +
surge baked in); these constants reconstruct a comparable total.

Ballpark sources (2025-2026): GrabCar ~75 THB base + ~12.5 THB/km incl. time;
Bolt ~15-25% cheaper than Grab; motorbike taxi ~26-35 THB for a 1-2 km hop.

Used by scoring.py to turn "distance to campus" into a monthly commute cost.
"""

# ---------- the config: tune these in one place ----------
# "car" = private-hire car (Grab/Bolt economy). Transit and walking have no
# ride-hailing provider, so their grab/bolt tables are identical on purpose —
# the provider choice simply doesn't change those fares.
RATES = {
    "car": {                                  # private-hire car (Grab/Bolt)
        "avg_speed_kmh": 16,                  # Bangkok traffic
        "grab": {"base": 45, "per_km": 10.0, "per_min": 1.5, "min": 60},
        "bolt": {"base": 38, "per_km": 8.5,  "per_min": 1.2, "min": 50},
    },
    "bike": {                                 # motorbike taxi: cheaper, faster
        "avg_speed_kmh": 23,                  # lane-splits the traffic
        "grab": {"base": 15, "per_km": 6.0, "per_min": 0.5, "min": 25},
        "bolt": {"base": 12, "per_km": 5.5, "per_min": 0.4, "min": 22},
    },
    "transit": {                              # BTS/MRT/bus blend, door-to-door
        "avg_speed_kmh": 20,                  # in-vehicle is faster; this folds
                                              # in the walk + wait overhead
        "grab": {"base": 10, "per_km": 2.5, "per_min": 0.0, "min": 16},
        "bolt": {"base": 10, "per_km": 2.5, "per_min": 0.0, "min": 16},
    },
    "walk": {                                 # free, slow — for the truly close
        "avg_speed_kmh": 4.8,
        "grab": {"base": 0, "per_km": 0.0, "per_min": 0.0, "min": 0},
        "bolt": {"base": 0, "per_km": 0.0, "per_min": 0.0, "min": 0},
    },
}
SURGE_DEFAULT = 1.0       # peak hours / rain typically 1.2-1.5
WEEKS_PER_MONTH = 4.3


def estimate_one_way(distance_km, mode="car", provider="grab", surge=SURGE_DEFAULT):
    """Estimate one trip. Returns (fare_thb, minutes).

    Fare = (base + per-km + per-minute) x surge, floored at the provider's
    minimum charge — the same structure the apps use for upfront pricing.
    """
    mode_config = RATES[mode]
    provider_rates = mode_config[provider]

    minutes = distance_km / mode_config["avg_speed_kmh"] * 60
    fare = (
        provider_rates["base"]
        + provider_rates["per_km"] * distance_km
        + provider_rates["per_min"] * minutes
    ) * surge
    fare = max(fare, provider_rates["min"])

    return round(fare), round(minutes)


def monthly_commute(distance_km, commute_days, mode="car", provider="grab",
                    surge=SURGE_DEFAULT):
    """Round-trip monthly fare + time for a given commute.

    `commute_days` is days per WEEK; a month is ~4.3 weeks, and every commute
    day means two trips (there and back).
    """
    one_way_fare, one_way_minutes = estimate_one_way(distance_km, mode, provider, surge)
    # trips per month = 2 (round trip) x days/week x ~4.3 weeks. Written inline
    # (not via a shared subexpression) to keep float rounding bit-identical.
    return {
        "one_way_thb": one_way_fare,
        "one_way_min": one_way_minutes,
        "monthly_fare_thb": round(one_way_fare * 2 * commute_days * WEEKS_PER_MONTH),
        "monthly_hours": round(one_way_minutes * 2 * commute_days * WEEKS_PER_MONTH / 60, 1),
    }


def all_modes(distance_km, commute_days, provider="grab", surge=SURGE_DEFAULT):
    """Monthly fare + time for EVERY mode, so the UI can compare/toggle
    car/bike/transit/walk from a single search (the headline trade-off)
    without recomputing rates client-side."""
    return {
        mode: monthly_commute(distance_km, commute_days, mode, provider, surge)
        for mode in RATES
    }


# old name kept as an alias so existing callers/tests don't break
both_modes = all_modes


if __name__ == "__main__":
    # quick eyeball check of the rate table at typical commute distances
    for km in (3, 8, 15):
        car = monthly_commute(km, 5, "car")
        bike = monthly_commute(km, 5, "bike")
        print(f"{km:>2}km @5d/wk  "
              f"CAR THB{car['monthly_fare_thb']:>5}/mo ({car['monthly_hours']}h)   "
              f"BIKE THB{bike['monthly_fare_thb']:>5}/mo ({bike['monthly_hours']}h)")
