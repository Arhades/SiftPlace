"""Cost-of-living estimates: the "what else you'll spend" block under listings.

Turns "true cost" from rent+commute into real monthly cost of living by adding
rough per-person estimates for utilities, internet, mobile and food. Numbers
are a static snapshot of open crowd-sourced data (Numbeo city averages,
mid-2026) — deliberately coarse, clearly labelled as estimates, and requiring
zero API keys or network calls (fail-safe by construction).

Scaling, kept explainable:
  * utilities scale with unit size (aircon dominates a Bangkok bill) and are
    split across occupants;
  * internet is per household, split across occupants;
  * mobile + food are per person.

Cities not in the table fall back to Bangkok values with a note — wrong in
absolute terms but still communicates the categories a student forgets.
"""
from __future__ import annotations

# per-month THB at the reference unit size (SQM_REFERENCE), one person.
# source: Numbeo city averages snapshot, mid-2026 (converted to THB).
SQM_REFERENCE = 30
CITY_TABLE: dict[str, dict[str, int]] = {
    "bangkok":   {"utilities": 2600, "internet": 600,  "mobile": 350,  "food": 9000},
    "tokyo":     {"utilities": 5500, "internet": 1100, "mobile": 900,  "food": 16000},
    "seoul":     {"utilities": 4700, "internet": 700,  "mobile": 1000, "food": 15000},
    "singapore": {"utilities": 4200, "internet": 1100, "mobile": 500,  "food": 15000},
}
DEFAULT_CITY = "bangkok"

# clamp how far unit size can push the utilities estimate
UTIL_SCALE_MIN, UTIL_SCALE_MAX = 0.7, 2.0


def estimate(city: str | None, space_sqm: float | None = None,
             occupancy: int = 1) -> dict:
    """Rough per-person monthly extras for a listing. Never raises."""
    try:
        key = (city or "").strip().lower()
        base = CITY_TABLE.get(key)
        approximate = base is None
        if base is None:
            base = CITY_TABLE[DEFAULT_CITY]
        people = max(1, occupancy or 1)

        sqm_scale = (space_sqm or SQM_REFERENCE) / SQM_REFERENCE
        sqm_scale = max(UTIL_SCALE_MIN, min(UTIL_SCALE_MAX, sqm_scale))

        utilities = round(base["utilities"] * sqm_scale / people)
        internet = round(base["internet"] / people)
        mobile = base["mobile"]
        food = base["food"]
        note = ("rough per-person estimates"
                + (" (city not in our table — Bangkok-level numbers)" if approximate else ""))
        return {
            "utilities": utilities, "internet": internet,
            "mobile": mobile, "food": food,
            "total": utilities + internet + mobile + food,
            "note": note,
            "source": "Numbeo open data snapshot, mid-2026",
        }
    except Exception:
        return {"utilities": None, "internet": None, "mobile": None, "food": None,
                "total": None, "note": "estimates unavailable", "source": ""}
