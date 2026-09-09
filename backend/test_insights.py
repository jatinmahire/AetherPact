import unittest
import sys
import os

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from main import (
    compute_confidence_label,
    generate_match_insight,
    generate_negotiation_insight,
    match_listings,
    MatchRequest,
    negotiate,
    NegotiateRequest,
    tokens,
    users
)

class DummyRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}

class TestInsightsLayer(unittest.TestCase):

    def test_confidence_labels(self):
        self.assertEqual(compute_confidence_label(0.95), "Strong Match")
        self.assertEqual(compute_confidence_label(0.75), "Strong Match")
        self.assertEqual(compute_confidence_label(0.749), "Good Match")
        self.assertEqual(compute_confidence_label(0.50), "Good Match")
        self.assertEqual(compute_confidence_label(0.499), "Partial Match")
        self.assertEqual(compute_confidence_label(0.30), "Partial Match")
        self.assertEqual(compute_confidence_label(0.299), "Weak Match")
        self.assertEqual(compute_confidence_label(0.0), "Weak Match")

    def test_generate_match_insight_strengths_and_weaknesses(self):
        # Semantic highest, price lowest (<0.5)
        bd1 = {"semantic": 0.85, "price_fit": 0.20, "distance": 0.60}
        insight1 = generate_match_insight(bd1, 0.70)
        self.assertIn("description closely matches what you described", insight1)
        self.assertIn("further from your stated budget than others", insight1)

        # Distance highest, no component < 0.5 (lowest is 0.55) -> only 1 sentence
        bd2 = {"semantic": 0.60, "price_fit": 0.55, "distance": 0.90}
        insight2 = generate_match_insight(bd2, 0.75)
        self.assertIn("closest available options to your location", insight2)
        self.assertNotIn("weaker", insight2)
        self.assertNotIn("further", insight2)
        self.assertNotIn("farther", insight2)

        # Price fit highest, distance lowest (<0.5)
        bd3 = {"semantic": 0.50, "price_fit": 0.95, "distance": 0.10}
        insight3 = generate_match_insight(bd3, 0.60)
        self.assertIn("price is very close to your stated budget", insight3)
        self.assertIn("farther from your location than others", insight3)

    def test_negotiation_insight_movement_comparison(self):
        # Provider moved more: ask=25000, offer=19000, clearing=21000
        # provider moved |25000 - 21000| = 4000. seeker moved |19000 - 21000| = 2000.
        insight_p = generate_negotiation_insight(provider_ask=25000.0, seeker_offer=19000.0, clearing_price=21000.0)
        self.assertTrue(insight_p.startswith("The provider moved further from their initial ask"))
        self.assertIn("4,000", insight_p)
        self.assertIn("2,000", insight_p)

        # Seeker moved more: ask=22000, offer=15000, clearing=20000
        # provider moved |22000 - 20000| = 2000. seeker moved |15000 - 20000| = 5000.
        insight_s = generate_negotiation_insight(provider_ask=22000.0, seeker_offer=15000.0, clearing_price=20000.0)
        self.assertTrue(insight_s.startswith("The seeker moved further from their initial offer"))
        self.assertIn("5,000", insight_s)
        self.assertIn("2,000", insight_s)

        # Equal movement: ask=22000, offer=18000, clearing=20000
        # both moved 2000
        insight_eq = generate_negotiation_insight(provider_ask=22000.0, seeker_offer=18000.0, clearing_price=20000.0)
        self.assertIn("Both parties conceded equally", insight_eq)
        self.assertIn("2,000", insight_eq)

    def test_two_different_search_queries_produce_different_insights(self):
        req1 = MatchRequest(
            description="luxury banquet hall with acoustic insulation for grand wedding reception",
            budget=16000.0,
            lat=19.0680,
            lng=72.8680
        )
        res1 = match_listings(req1)
        matches1 = res1["matches"]
        self.assertTrue(len(matches1) > 0)
        top1 = matches1[0]
        self.assertIn("insight", top1)
        self.assertIn("confidence_label", top1)

        req2 = MatchRequest(
            description="air-conditioned 14-seater luxury shuttle vans for airport passenger transport",
            budget=6000.0,
            lat=19.0900,
            lng=72.8650
        )
        res2 = match_listings(req2)
        matches2 = res2["matches"]
        self.assertTrue(len(matches2) > 0)
        top2 = matches2[0]

        # Check that different queries against different matching top results produce distinct insights
        self.assertNotEqual(top1["insight"], top2["insight"])

    def test_low_price_fit_mentions_price_as_weakness(self):
        # Grand Ballroom has price 15000, but budget is only 3000 (extreme mismatch)
        req = MatchRequest(
            description="luxury ballroom banquet hall for gala",
            budget=3000.0,
            lat=19.0680,
            lng=72.8680,
            resource_type="banquet_hall"
        )
        res = match_listings(req)
        # Find the Grand Ballroom listing (id=1)
        ballroom_match = next((m for m in res["matches"] if m["listing"]["id"] == 1), None)
        self.assertIsNotNone(ballroom_match)
        self.assertLess(ballroom_match["breakdown"]["price_fit"], 0.5)
        self.assertIn("further from your stated budget than others", ballroom_match["insight"])

    def test_negotiate_endpoint_returns_insight(self):
        # Create token for test user
        token = "testtoken123"
        tokens[token] = 1 # provider@aetherpact.com

        req = NegotiateRequest(
            provider_min=14000.0,
            provider_ask=16000.0,
            seeker_offer=13000.0,
            seeker_max=15500.0
        )
        dummy_req = DummyRequest(headers={"Authorization": f"Bearer {token}"})
        res = negotiate(req, dummy_req)
        self.assertEqual(res["status"], "settled")
        self.assertIn("negotiation_insight", res)
        self.assertIsInstance(res["negotiation_insight"], str)
        self.assertGreater(len(res["negotiation_insight"]), 10)

if __name__ == "__main__":
    unittest.main()
