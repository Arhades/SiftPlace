"""Focused tests for Sift's deterministic in-app Q&A fallback."""
from __future__ import annotations

import os
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from llm import chat_reply

LISTINGS = [
    {
        "name": "Ari Garden Residence",
        "area": "Ari",
        "score": 91,
        "rent": 14000,
        "true_cost": 15800,
        "price_known": True,
        "commute_min": 18,
        "monthly_fare": 1800,
        "monthly_hours": 12.9,
        "mode": "transit",
        "subscores": {"cost": 0.84, "location": 0.94, "living": 0.81},
        "matched_amenities": ["wifi", "desk"],
    },
    {
        "name": "Samyan Student House",
        "area": "Samyan",
        "score": 84,
        "rent": 12000,
        "true_cost": 16500,
        "price_known": True,
        "commute_min": 29,
        "monthly_fare": 4500,
        "monthly_hours": 20.8,
        "mode": "transit",
        "subscores": {"cost": 0.76, "location": 0.78, "living": 0.86},
        "matched_amenities": ["wifi"],
    },
]


class ChatGuideTests(unittest.TestCase):
    def ask(self, text: str, screen: str = "listings",
            listings: list[dict] | None = None) -> dict:
        with patch.dict(os.environ, {"AGNES_API_KEY": "", "OPENAI_API_KEY": ""}):
            return chat_reply(
                [{"role": "user", "content": text}],
                screen_context=screen,
                listings_context=listings,
            )

    def test_like_button_uses_real_card_position(self):
        result = self.ask("Where is the like button?")
        self.assertIn("top-right", result["reply"])
        self.assertIn("Saved", result["reply"])
        self.assertEqual(result["parsed"]["detected"], [])

    def test_filter_route_starts_from_current_tab(self):
        result = self.ask("Where is the filter button?", screen="saved")
        self.assertIn("Tap Listings", result["reply"])
        self.assertIn("top-right", result["reply"])
        self.assertEqual(result["engine"], "ui-guide")

    def test_filter_help_does_not_treat_gym_as_a_new_demand(self):
        result = self.ask("How do I add a gym in the filters?")
        self.assertIn("Filter", result["reply"])
        self.assertEqual(result["parsed"]["detected"], [])

    def test_compare_requires_two_saved_homes(self):
        result = self.ask("How do I compare listings?")
        self.assertIn("at least two", result["reply"])
        self.assertIn("Compare Listings", result["reply"])

    def test_housing_request_still_sets_demands(self):
        result = self.ask("I want a quiet street near a gym")
        self.assertTrue(result["parsed"]["detected"])
        self.assertNotEqual(result["engine"], "ui-guide")

    def test_housing_question_is_not_mistaken_for_ui_help(self):
        result = self.ask("Where can I find a quiet condo near a gym?")
        self.assertTrue(result["parsed"]["detected"])
        self.assertNotEqual(result["engine"], "ui-guide")

    def test_true_cost_formula_matches_scoring_code(self):
        result = self.ask("How do you calculate the total cost?")
        self.assertIn("rent + estimated monthly commute fare", result["reply"])
        self.assertIn("utilities", result["reply"])
        self.assertEqual(result["engine"], "product-guide")
        self.assertEqual(result["parsed"]["detected"], [])

    def test_match_score_explains_all_three_axes(self):
        result = self.ask("How is the match score calculated?")
        self.assertIn("Cost, Location, and Living", result["reply"])
        self.assertIn("weights", result["reply"])

    def test_comparison_uses_current_listing_scores(self):
        result = self.ask("Which place is better?", listings=LISTINGS)
        self.assertIn("Ari Garden Residence", result["reply"])
        self.assertIn("91%", result["reply"])
        self.assertIn("Samyan Student House", result["reply"])
        self.assertIn("current filters and weights", result["reply"])

    def test_cheapest_uses_true_cost_not_rent_alone(self):
        result = self.ask("Which is the cheapest place?", listings=LISTINGS)
        self.assertIn("Ari Garden Residence", result["reply"])
        self.assertIn("฿15,800/mo", result["reply"])

    def test_comparison_without_context_refuses_to_guess(self):
        result = self.ask("Which place is better?")
        self.assertIn("Open Listings", result["reply"])
        self.assertIn("won't recommend", result["reply"])


if __name__ == "__main__":
    unittest.main()
