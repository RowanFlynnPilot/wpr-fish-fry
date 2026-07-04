#!/usr/bin/env python3
"""Thursday check: is the paid featured slot filled for tomorrow's fish fry?

The featured slot is the product's main revenue lever; an empty slot on a
Friday is money left on the table. This runs Thursday morning so there's a
whole business day to fix it.

Usage:
    python build/check_featured.py <csv_url_or_path>

Exit 0 if an active, featured-tier venue holds the slot; exit 1 with a short
report on stdout if the slot is empty. The workflow turns exit 1 into a
GitHub issue for the curators.
"""

import sys

from check_links import load_rows


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python build/check_featured.py <csv_url_or_path>", file=sys.stderr)
        sys.exit(2)

    rows = load_rows(sys.argv[1])
    holder = next(
        (
            r
            for r in rows
            if r.get("featured_this_week") == "TRUE" and r.get("active") == "TRUE"
        ),
        None,
    )

    if holder:
        print(f"Featured slot is set: {holder['venue_name']}.")
        return

    print("## No featured fish fry set for this Friday\n")
    print(
        "The weekly featured slot is empty. Set `featured_this_week` to TRUE "
        "on one active, featured-tier row in the sheet — or enjoy a quiet "
        "week if no sponsor booked it."
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
