"""Pluggable listings sources behind /search.

Each provider returns the same raw-listing shape; gather_listings() runs every
configured provider, merges the results, and de-duplicates the same physical
place across sources (fuzzy name + coordinate match) so a priced affiliate
offer enriches — rather than duplicates — the free OSM place.
"""
from providers.base import ListingsProvider, RawListing
from providers.merge import gather_listings, active_providers

__all__ = ["ListingsProvider", "RawListing", "gather_listings", "active_providers"]
