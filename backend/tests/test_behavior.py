"""Behaviour-pinning tests for the pure calculation modules.

Purpose: the readability refactor (rename variables, unstack one-liners) must
not change ANY output. This script runs a spread of sample inputs through
fare.py and scoring.py and compares the results against `golden.json`,
which was captured from the code BEFORE the refactor.

Run it directly (no pytest needed):

    cd backend
    python tests/test_behavior.py             # compare against golden.json
    python tests/test_behavior.py --record    # (re)capture golden.json

Only re-record when a behaviour change is intentional.
"""
from __future__ import annotations

import json
import pathlib
import sys

# allow "python tests/test_behavior.py" from backend/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fare import all_modes, estimate_one_way, monthly_commute
from scoring import (clamp, distance_score, haversine_m, rank_listings,
                     score_listing, sharpen_weights)

GOLDEN = pathlib.Path(__file__).parent / "golden.json"

# --- sample inputs (a deliberate spread: typical, edge, missing-data) ---------

SAMPLE_LISTINGS = [
    {   # fully specified (demo-style) listing
        "name": "Lumpini Condo", "area": "Sathorn", "lat": 13.723, "lon": 100.529,
        "price": 12000, "type": "condo",
        "amenities": ["wifi", "kitchen", "laundry"],
        "nearby": {"gym": 250, "supermarket": 800, "transit": 400},
        "street": {"vibe": "quiet", "safety": 4}, "space_sqm": 32,
        "reviews": [{"stars": 4, "text": "nice"}], "source": "mock",
    },
    {   # OSM-style listing: no price, no amenities, no space
        "name": "Riverside Hostel", "area": "", "lat": 13.740, "lon": 100.510,
        "price": None, "type": "hostel", "amenities": None,
        "nearby": {"transit": 1200}, "street": {}, "space_sqm": None,
        "reviews": [], "source": "osm",
    },
    {   # affiliate-style listing with stars + capacity + min stay
        "name": "Thonglor Suites", "area": "Thonglor", "lat": 13.731, "lon": 100.583,
        "price": 22000, "type": "hotel", "amenities": ["wifi", "gympool"],
        "nearby": {"mall": 300}, "street": {"vibe": "lively", "safety": 5},
        "space_sqm": 45, "reviews": [], "source": "travelpayouts",
        "stars": 4, "rating": 8.6, "capacity": 2, "min_stay_months": 6,
    },
]

SAMPLE_PREFS = [
    {   # balanced weights, solo student
        "weights": {"cost": 5, "location": 5, "living": 5},
        "budget": 15000, "anchor": [13.7563, 100.5018],
        "commute_days": 5, "max_commute": 40,
        "nearby": ["gym", "transit"], "vibe": "quiet",
        "types": ["condo", "hostel"], "amenities": ["wifi", "kitchen"],
        "commute_mode": "car", "provider": "grab", "value_of_time": 0,
        "occupancy": 1,
    },
    {   # cost-driven biker with value-of-time and a short stay
        "weights": {"cost": 9, "location": 2, "living": 1},
        "budget": 10000, "anchor": [13.7563, 100.5018],
        "commute_days": 3, "max_commute": 20,
        "nearby": ["supermarket"], "vibe": None,
        "types": [], "amenities": [],
        "commute_mode": "bike", "provider": "bolt", "value_of_time": 100,
        "occupancy": 1, "stay_months": 3.0,
    },
    {   # group of 4 (capacity + hostel penalty paths)
        "weights": {"cost": 3, "location": 8, "living": 6},
        "budget": 40000, "anchor": [13.7563, 100.5018],
        "commute_days": 5, "max_commute": 0,
        "nearby": [], "vibe": "lively",
        "types": ["condo"], "amenities": ["wifi"],
        "commute_mode": "car", "provider": "grab", "value_of_time": 0,
        "occupancy": 4,
    },
]


def compute_all() -> dict:
    """Run every sample input through the calculation modules."""
    out: dict = {}

    out["haversine"] = [
        haversine_m(13.7563, 100.5018, 13.723, 100.529),
        haversine_m(0, 0, 0, 1),
        haversine_m(13.7, 100.5, 13.7, 100.5),
    ]
    out["clamp"] = [clamp(-0.5), clamp(0.4), clamp(1.7), clamp(5, 1, 3)]
    out["distance_score"] = [distance_score(m) for m in (0, 300, 900, 2000, 5000)]
    out["sharpen"] = [
        sharpen_weights({"cost": 5, "location": 5, "living": 5}),
        sharpen_weights({"cost": 9, "location": 3, "living": 2}),
        sharpen_weights({"cost": 0, "location": 0, "living": 0}),
    ]

    out["fare_one_way"] = [
        estimate_one_way(km, mode, provider)
        for km in (0.5, 3, 8, 15)
        for mode in ("car", "bike", "transit", "walk")
        for provider in ("grab", "bolt")
    ]
    out["fare_monthly"] = [
        monthly_commute(8, days, "car", "grab") for days in (0, 3, 5, 7)
    ]
    out["fare_both"] = all_modes(6.5, 5, "bolt")

    out["score_listing"] = [
        score_listing(listing, prefs)
        for prefs in SAMPLE_PREFS
        for listing in SAMPLE_LISTINGS
    ]
    out["rank"] = [
        rank_listings(SAMPLE_LISTINGS, prefs, top_n=2) for prefs in SAMPLE_PREFS
    ]
    return out


def main() -> int:
    actual = compute_all()
    if "--record" in sys.argv:
        GOLDEN.write_text(json.dumps(actual, indent=1, sort_keys=True),
                          encoding="utf-8")
        print(f"recorded {GOLDEN}")
        return 0

    expected = json.loads(GOLDEN.read_text(encoding="utf-8"))
    # round-trip through JSON so float/tuple representations compare equal
    actual = json.loads(json.dumps(actual))
    if actual == expected:
        print("OK — behaviour matches golden.json")
        return 0

    for key in expected:
        if actual.get(key) != expected[key]:
            print(f"MISMATCH in '{key}':")
            print("  expected:", json.dumps(expected[key])[:400])
            print("  actual:  ", json.dumps(actual.get(key))[:400])
    return 1


if __name__ == "__main__":
    sys.exit(main())
