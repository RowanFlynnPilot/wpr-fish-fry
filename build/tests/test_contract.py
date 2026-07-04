"""Contract regression tests for build.py's sheet validation.

The sheet contract is the interface between the newsroom and the widget;
these tests pin the rules so a build.py refactor can't quietly loosen them.
Run: python -m unittest discover -s build/tests
"""

import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build  # build/build.py


def base_row(**overrides):
    row = {
        "venue_name": "Testy's Tavern",
        "venue_type": "bar",
        "address": "1 Main St",
        "city": "Wausau",
        "phone": "",
        "website": "",
        "fish": "perch",
        "price_low": "10",
        "price_high": "14",
        "sides": "",
        "hours": "Fri 4-8 PM",
        "all_you_can_eat": "FALSE",
        "takeout": "FALSE",
        "tier": "free",
        "description": "",
        "photo_url": "",
        "menu_url": "",
        "featured_this_week": "FALSE",
        "editor_note": "",
        "active": "TRUE",
        "_row": 2,
    }
    row.update(overrides)
    return row


def validate_expecting_failure(testcase, rows, *fragments):
    stderr = io.StringIO()
    with testcase.assertRaises(SystemExit), contextlib.redirect_stderr(stderr):
        build.validate(rows)
    for fragment in fragments:
        testcase.assertIn(fragment, stderr.getvalue())


class ContractTests(unittest.TestCase):
    def test_valid_row_passes(self):
        venues = build.validate([base_row()])
        self.assertEqual(venues[0]["venue_name"], "Testy's Tavern")
        self.assertEqual(venues[0]["fish"], ["perch"])

    def test_duplicate_venue_name_fails(self):
        rows = [base_row(), base_row(_row=3)]
        validate_expecting_failure(self, rows, "duplicate venue_name")

    def test_free_tier_with_paid_columns_fails(self):
        rows = [base_row(photo_url="https://example.com/pic.jpg")]
        validate_expecting_failure(self, rows, "paid-tier column(s)")

    def test_featured_flag_requires_featured_tier(self):
        rows = [base_row(featured_this_week="TRUE")]
        validate_expecting_failure(self, rows, "only featured-tier venues")

    def test_two_featured_rows_fail(self):
        rows = [
            base_row(
                tier="featured",
                featured_this_week="TRUE",
                description="A",
            ),
            base_row(
                venue_name="Second Spot",
                tier="featured",
                featured_this_week="TRUE",
                description="B",
                _row=3,
            ),
        ]
        validate_expecting_failure(self, rows, "more than one row")

    def test_unknown_fish_fails(self):
        rows = [base_row(fish="perch, muskie")]
        validate_expecting_failure(self, rows, "muskie")

    def test_price_low_above_high_fails(self):
        rows = [base_row(price_low="20", price_high="12")]
        validate_expecting_failure(self, rows, "price_low is greater")

    def test_sloppy_boolean_fails(self):
        rows = [base_row(takeout="yes")]
        validate_expecting_failure(self, rows, "must be exactly TRUE or FALSE")

    def test_normalize_address(self):
        # load_csv strips cells before this runs; the key's job is lowercase
        # and collapsing internal runs of whitespace.
        self.assertEqual(
            build.normalize_address("4200  Rib Mountain Dr", "Wausau"),
            "4200 rib mountain dr, wausau",
        )


if __name__ == "__main__":
    unittest.main()
