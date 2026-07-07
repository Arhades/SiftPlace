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
    commute_mode: Literal["car", "bike", "transit", "walk"] = Field(
        "car", description="Private-hire car, motorbike taxi, public transport "
                           "or walking — drives the fare")
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
    commute_mode: Literal["car", "bike", "transit", "walk"] = Field(
        "car", description="Private-hire car, motorbike taxi, public transport "
                           "or walking — drives the fare")
    provider: Literal["grab", "bolt"] = Field("grab", description="Fare rate table to use")
    value_of_time: int = Field(
        0, ge=0, description="THB/hour you put on commute time; 0 = ignore time in ranking")
    radius_m: int = Field(2500, ge=500, le=8000, description="Search radius around the centre")
    max_listings: int = Field(30, ge=1, le=60)
    top_n: int = Field(5, ge=1, le=20)
    # pagination: results come back one page at a time. page_size falls back to
    # top_n so pre-pagination clients see exactly what they always did.
    page: int = Field(1, ge=1, le=50)
    page_size: int | None = Field(None, ge=1, le=24)
    # lease-length filter (Task: lease_type). Listings with a KNOWN conflicting
    # lease type are excluded; unknown ones pass with a "confirm with landlord" note.
    lease_types: list[str] = Field(default_factory=list,
                                   description="standard | short_term | monthly")
    # privacy: allow the submitted note to be stored as NLP training data
    allow_training: bool = Field(True, description="Opt-out switch for note storage")


class ParseRequest(BaseModel):
    """Free-text 'Anything else?' note to turn into structured demands."""
    text: str = Field("", max_length=2000)


class NoteDeleteRequest(BaseModel):
    """Privacy: remove a previously stored note from the NLP training data."""
    text: str = Field(..., min_length=1, max_length=2000)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    """A turn of the Sift mascot conversation. `messages` is the running
    transcript (oldest first); the last entry must be the user's new message."""
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=30)
    # what's already selected, so the assistant doesn't re-ask (optional)
    filters_summary: str | None = Field(None, max_length=1000)


class ChatResponse(BaseModel):
    reply: str
    # same shape as /parse: amenities/nearby/types/vibe/weight_nudges/must_haves/detected
    parsed: dict
    engine: str = "rules"


class FeedbackRequest(BaseModel):
    """Community accuracy vote / scam report for one listing."""
    name: str = Field(..., min_length=1, max_length=200)
    lat: float
    lon: float
    accurate: bool
    report: str | None = Field(None, max_length=1000)


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
    # lease length when known: standard | short_term | monthly (None = ask)
    lease_type: str | None = None
    # "what else you'll spend" monthly estimates (see col.py)
    cost_of_living: dict | None = None
    # community accuracy feedback aggregate: {up, down, flagged}
    community: dict | None = None
    # semantic layer (when enabled): cosine similarity + LLM one-liner
    semantic: float | None = None
    ai_reason: str | None = None


class ScoreResponse(BaseModel):
    count: int
    results: list[ListingResult]
    note: str | None = None
    centre: list[float] | None = None
    radius_used: int | None = None
    # stay metadata (from check_in/check_out). Seasonal rain/flood assessment
    # lives in /flood-risk alone (the old rainy_season boolean duplicated it).
    stay_months: float | None = None
    # what the NLP layer extracted from notes/other answers (transparency)
    parsed: dict | None = None
    providers: list[str] = Field(default_factory=list)
    # pagination (total = all ranked matches; results holds only this page)
    total: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
