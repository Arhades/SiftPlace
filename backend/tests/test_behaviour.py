"""Behaviour lock for the readability refactor.

The refactor of fare.py / scoring.py / osm.py / nlp.py must NOT change any
output. This script runs a spread of sample inputs through the pure functions
and compares the results against a baseline captured BEFORE the refactor.

Usage (from backend/):
    python tests/test_behaviour.py --capture   # write tests/baseline.json
    python tests/test_behaviour.py             # compare against the baseline

Dependency-free on purpose (no pytest) so it runs in any checkout.
"""
from __future__ import annotations

import json
import pathlib
import sys

# run from backend/ — make the backend modules importable
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import fare
import nlp
import osm
import scoring

BASELINE = pathlib.Path(__file__).parent / "baseline.json"


def sample_listings() -> list[dict]:
    """A priced condo, an unpriced OSM hotel, and a hostel with quality data."""
    return [
        {
            "name": "Priced Condo", "area": "On Nut", "lat": 13.705, "lon": 100.601,
            "price": 12000, "type": "condo",
            "amenities": ["wifi", "kitchen"],
            "nearby": {"gym": 250, "supermarket": 900, "transit": 400},
            "street": {"vibe": "quiet", "safety": 4}, "space_sqm": 28,
            "reviews": [{"stars": 4, "text": "nice"}], "source": "mock",
        },
        {
            "name": "OSM Hotel", "area": "", "lat": 13.745, "lon": 100.535,
            "price": None, "type": "hotel", "amenities": None,
            "nearby": {"transit": 1800}, "street": {"vibe": None, "safety": 3},
            "space_sqm": None, "reviews": [], "source": "osm",
        },
        {
            "name": "Star Hostel", "area": "Ari", "lat": 13.779, "lon": 100.545,
            "price": 6500, "type": "hostel", "amenities": ["wifi"],
            "nearby": {"gym": 3000, "supermarket": 150},
            "street": {"vibe": "lively", "safety": 3}, "space_sqm": 12,
            "reviews": [], "source": "mock", "stars": 4.0,
            "capacity": 2, "min_stay_months": 1,
        },
    ]


def pref_variants() -> list[dict]:
    base = {
        "weights": {"cost": 7, "location": 7, "living": 5},
        "budget": 20000, "anchor": [13.7384, 100.5306],
        "commute_days": 5, "max_commute": 0,
        "nearby": ["gym", "supermarket"], "vibe": "quiet",
        "types": ["condo"], "amenities": ["wifi", "desk"],
        "commute_mode": "car", "provider": "grab", "value_of_time": 0,
    }
    cost_heavy = dict(base, weights={"cost": 9, "location": 3, "living": 2},
                      commute_mode="bike", provider="bolt", value_of_time=100,
                      max_commute=30)
    group = dict(base, occupancy=4, stay_months=3.0, types=[], vibe=None, nearby=[])
    return [base, cost_heavy, group]


NOTES = [
    "",
    "quiet place with fast wifi and a desk, near the BTS please",
    "cheap as possible, student budget, close to a night market and 7-eleven",
    "luxury condo with a pool, money is no object, must be pet friendly",
    "co-living or hostel is fine, happy to travel, need laundry and a kitchen",
]


def capture() -> dict:
    out: dict = {}

    # --- fare.py -------------------------------------------------------------
    fares = []
    for km in (0.5, 3, 8.2, 15):
        for mode in ("car", "bike"):
            for provider in ("grab", "bolt"):
                for surge in (1.0, 1.3):
                    fares.append({
                        "in": [km, mode, provider, surge],
                        "one_way": fare.estimate_one_way(km, mode, provider, surge),
                        "monthly": fare.monthly_commute(km, 5, mode, provider, surge),
                    })
    fares.append({"in": "both_modes(8.2, 3, bolt)", "out": fare.both_modes(8.2, 3, "bolt")})
    out["fare"] = fares

    # --- scoring.py ----------------------------------------------------------
    out["haversine"] = [
        scoring.haversine_m(13.7384, 100.5306, 13.705, 100.601),
        scoring.haversine_m(0, 0, 0, 0),
        scoring.haversine_m(51.5, -0.12, 48.85, 2.35),
    ]
    out["clamp"] = [scoring.clamp(-1), scoring.clamp(0.5), scoring.clamp(7, 0, 5)]
    out["sharpen"] = [
        scoring.sharpen_weights({"cost": 9, "location": 3, "living": 2}),
        scoring.sharpen_weights({"cost": 0, "location": 0, "living": 0}),
        scoring.sharpen_weights({"cost": 5, "location": 5, "living": 5}),
    ]
    out["distance_score"] = [scoring.distance_score(m) for m in (100, 300, 800, 2000, 5000)]
    out["scored"] = [
        [scoring.score_listing(l, p) for l in sample_listings()]
        for p in pref_variants()
    ]
    out["ranked"] = [
        scoring.rank_listings(sample_listings(), p, top_n=2) for p in pref_variants()
    ]

    # --- osm.py pure helpers ---------------------------------------------------
    out["osm_coords"] = [
        osm._coords({"lat": 13.7, "lon": 100.5}),
        osm._coords({"center": {"lat": 13.8, "lon": 100.6}}),
        osm._coords({"center": {}}),
    ]
    pts = [(13.74, 100.53, "a"), (13.75, 100.54, "b")]
    out["osm_nearest"] = [osm.nearest(13.7384, 100.5306, pts), osm.nearest(13.7384, 100.5306, [])]

    # --- nlp.py rules parser ---------------------------------------------------
    out["parse_rules"] = [nlp.parse_rules(t) for t in NOTES]

    return out


def main() -> int:
    got = capture()
    if "--capture" in sys.argv:
        BASELINE.write_text(json.dumps(got, indent=1, sort_keys=True), encoding="utf-8")
        print(f"baseline captured -> {BASELINE}")
        return 0
    want = json.loads(BASELINE.read_text(encoding="utf-8"))
    # round-trip through JSON so tuples/lists and float precision compare equal
    got = json.loads(json.dumps(got, sort_keys=True))
    if got == want:
        print("OK — behaviour identical to the captured baseline")
        return 0
    for key in want:
        if got.get(key) != want[key]:
            print(f"MISMATCH in '{key}':")
            print("  want:", json.dumps(want[key])[:400])
            print("  got: ", json.dumps(got.get(key))[:400])
    return 1


if __name__ == "__main__":
    sys.exit(main())
