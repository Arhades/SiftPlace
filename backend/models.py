"""Pydantic request/response models for the SiftPlace API."""
from __future__ import annotations

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
    top_n: int = Field(5, ge=1, le=20)


class CityScoreRequest(BaseModel):
    """Searches REAL OpenStreetMap listings for any city.

    Provide either `city` (it will be geocoded) and/or explicit anchor coords.
    """
    city: str | None = Field(None, description="e.g. 'Bangkok', 'Tokyo', 'Lisbon'")
    anchor_lat: float | None = None
    anchor_lon: float | None = None
    weights: Weights = Field(default_factory=Weights)
    budget: int = Field(20000, gt=0)
    commute_days: int = Field(5, ge=0, le=7)
    max_commute: int = Field(0, ge=0)
    nearby: list[str] = Field(default_factory=list)
    vibe: str | None = None
    types: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    radius_m: int = Field(2500, ge=500, le=8000, description="Search radius around the centre")
    max_listings: int = Field(30, ge=1, le=60)
    top_n: int = Field(5, ge=1, le=20)


class ListingResult(BaseModel):
    name: str
    area: str = ""
    score: int
    rent: int | None = None
    true_cost: int | None = None
    price_known: bool = True
    commute_min: int
    commute_cost: int | None = None
    met_nearby: list[str] = Field(default_factory=list)
    vibe: str | None = None
    type: str | None = None
    matched_amenities: list[str] = Field(default_factory=list)
    subscores: dict = Field(default_factory=dict)
    reviews: list = Field(default_factory=list)
    lat: float | None = None
    lon: float | None = None
    source: str = "mock"


class ScoreResponse(BaseModel):
    count: int
    results: list[ListingResult]
    note: str | None = None
