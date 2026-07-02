"""Pydantic request/response models for the SiftPlace API."""
from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field


class Weights(BaseModel):
    """How much the user cares about each factor (0-10 each, total <= 20)."""
    cost: int = Field(7, ge=0, le=10)
    location: int = Field(7, ge=0, le=10)
    living: int = Field(5, ge=0, le=10)


class ScoreRequest(BaseModel):
    """Scores the bundled demo listings (mock Bangkok data)."""
    weights: Weights = Field(default_factory=Weights)
    budget: int = Field(20000, gt=0, description="Monthly budget")
    anchor_lat: float = Field(13.7384, description="Where you commute to — latitude")
    anchor_lon: float = Field(100.5306, description="Where you commute to — longitude")
    commute_days: int = Field(5, ge=0, le=7)
    max_commute: int = Field(0, ge=0, description="Longest accepted commute (min); 0 = no limit")
    nearby: list[str] = Field(default_factory=list,
                              description="gym, supermarket, transit, mall, flea_market")
    vibe: str | None = Field(None, description="quiet or lively (or omit)")
    types: list[str] = Field(default_factory=list, description="condo, hotel, hostel")
    amenities: list[str] = Field(default_factory=list)
    commute_mode: Literal["car", "bike"] = Field(
        "car", description="Ride-hailing car (Grab/Bolt) or motorbike taxi — drives the fare")
    provider: Literal["grab", "bolt"] = Field("grab", description="Fare rate table to use")
    value_of_time: int = Field(
        0, ge=0, description="THB/hour you put on commute time; 0 = ignore time in ranking")
    top_n: int = Field(5, ge=1, le=20)


class CityScoreRequest(BaseModel):
    """Searches REAL listings (OSM + configured affiliate feeds) for any city.

    Provide either `city` (it will be geocoded) and/or explicit anchor coords.
    """
    city: str | None = Field(None, description="e.g. 'Bangkok', 'Tokyo', 'Lisbon'")
    anchor_lat: float | None = None
    anchor_lon: float | None = None
    weights: Weights = Field(default_factory=Weights)
    budget: float = Field(20000, gt=0, description="Monthly budget in `currency`")
    currency: str = Field("THB", description="Currency of `budget`; scoring runs in THB")
    check_in: dt.date | None = Field(None, description="Move-in date")
    check_out: dt.date | None = Field(None, description="Move-out date")
    occupancy: int = Field(1, ge=1, le=8, description="People staying")
    notes: str | None = Field(None, max_length=2000,
                              description="Free-text extra demands, parsed with NLP")
    other_terms: list[str] = Field(default_factory=list,
                                   description="Free-text 'Other' answers from any question")
    commute_days: int = Field(5, ge=0, le=7)
    max_commute: int = Field(0, ge=0)
    nearby: list[str] = Field(default_factory=list)
    vibe: str | None = None
    types: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    commute_mode: Literal["car", "bike"] = Field(
        "car", description="Ride-hailing car (Grab/Bolt) or motorbike taxi — drives the fare")
    provider: Literal["grab", "bolt"] = Field("grab", description="Fare rate table to use")
    value_of_time: int = Field(
        0, ge=0, description="THB/hour you put on commute time; 0 = ignore time in ranking")
    radius_m: int = Field(2500, ge=500, le=8000, description="Search radius around the centre")
    max_listings: int = Field(30, ge=1, le=60)
    top_n: int = Field(5, ge=1, le=20)


class ParseRequest(BaseModel):
    """Free-text 'Anything else?' note to turn into structured demands."""
    text: str = Field("", max_length=2000)


class Offer(BaseModel):
    """One provider's price for a listing (affiliate link carries the marker)."""
    provider: str
    label: str
    monthly_thb: int
    nightly_thb: int | None = None
    url: str | None = None


class ListingResult(BaseModel):
    name: str
    area: str = ""
    score: int
    rent: int | None = None
    true_cost: int | None = None
    true_cost_incl_time: int | None = None
    price_known: bool = True
    commute_min: int
    commute_cost: int | None = None
    mode: str = "car"
    one_way_fare: int | None = None
    monthly_fare: int | None = None
    monthly_hours: float = 0
    time_cost: int | None = None
    # Per-mode fare summary ({car:{...}, bike:{...}}) so the UI can compare/toggle
    # without a refetch. Each value: {one_way_thb, one_way_min, monthly_fare_thb, monthly_hours}.
    fares: dict = Field(default_factory=dict)
    met_nearby: list[str] = Field(default_factory=list)
    vibe: str | None = None
    type: str | None = None
    matched_amenities: list[str] = Field(default_factory=list)
    subscores: dict = Field(default_factory=dict)
    reviews: list = Field(default_factory=list)
    lat: float | None = None
    lon: float | None = None
    source: str = "mock"
    # multi-provider price comparison (cheapest first)
    offers: list[Offer] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    stars: float | None = None
    # spread markers: top_match | best_value | best_quality
    badge: str | None = None


class ScoreResponse(BaseModel):
    count: int
    results: list[ListingResult]
    note: str | None = None
    centre: list[float] | None = None
    radius_used: int | None = None
    # stay metadata (from check_in/check_out)
    stay_months: float | None = None
    rainy_season: bool = False
    # what the NLP layer extracted from notes/other answers (transparency)
    parsed: dict | None = None
    providers: list[str] = Field(default_factory=list)
