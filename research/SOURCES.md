# Draft venue data — sources and verification workflow

`fish_fry_draft.csv` is a research-sourced starter dataset for the Google
Sheet: 57 real Marathon County venues in the exact 20-column contract
format. **Every row is `active=FALSE` and carries an "UNVERIFIED IMPORT"
editor_note** — nothing publishes until a human verifies the row and flips
`active` to TRUE. If a row is activated without clearing the note, the
"UNVERIFIED IMPORT" text renders publicly — that's a deliberate tripwire,
not a bug.

## How to use it

1. Open `fish_fry_draft.csv`, copy the data rows (not the header), and paste
   them into the sheet below the existing rows — then delete the fictional
   sample venues (Pine Ridge Supper Club, The Walleye Shack, Northside
   Tavern, American Legion Post 492, Marathon Lanes, VFW Post 2110, Birch
   Creek, Lakeview Pavilion).
2. Verify a venue (a Friday-afternoon phone call answers everything):
   confirm the fish list, real prices, fry hours, AYCE/takeout; fix
   `venue_type` if the guess is wrong.
3. Replace the editor_note with something reader-facing (or clear it), set
   `active=TRUE`. The venue publishes within the hour; geocoding runs on
   first activation and will fail loudly if the address needs fixing.

## Sources

- **Venue roster (names, addresses, phones):** Wausau Pilot & Review's own
  [Lenten Fish Fry Guide](https://wausaupilotandreview.com/lenten-fish-fry-guide/)
  (retrieved 2026-07-10). WPR's guide, WPR's product — no rights issues.
- **Reader-poll notes:** WPR,
  ["Wausau readers have spoken"](https://wausaupilotandreview.com/2026/04/03/wausau-readers-have-spoken-this-is-the-best-fish-fry-in-the-wausau-area/)
  (April 2026): 1. Loading Zone (46 votes), 2. Cassel Bar & Grill (43),
  3. Trails End (38), 4. Carmelo's (28), 5. Trailside (25), 6. Cheeks and
  Red Granite (tie, 18), 8. Palms (16), 9. Hatley Hangout (14),
  10. Hog Creek (12).
- **Menu details:**
  [Visit Wausau fish fry roundup](https://www.visitwausau.com/blog/post/best-fish-fry-spots-in-the-wausau-area/)
  (Trails End fish list), web listings for Cassel Bar & Grill (haddock
  baked/fried, perch, shrimp, German potato salad) and Gorski's (cod,
  walleye, perch, shrimp; gorskiswi.com).

## What's placeholder vs. sourced

| field | status |
|---|---|
| venue_name, address, city, phone | from WPR's guide, as printed |
| venue_type | **inferred from the name** — review every row |
| fish | sourced for Cassel, Trails End, Gorski's; placeholder `cod` elsewhere |
| price_low/high | **placeholder 10–20 everywhere** — the contract requires numbers |
| hours | sourced-ish for Cassel/Gorski's (marked "confirm"); placeholder elsewhere |
| all_you_can_eat, takeout | FALSE everywhere — unknown, not asserted |
| website | only where verified (Loading Zone, Gorski's) |

## Known discrepancies to resolve

- **Carmelo's**: WPR guide says 3607 N Mountain Rd; Visit Wausau says
  149841 County Rd NN. Draft uses WPR's.
- **Cassel Bar & Grill**: WPR says 130665 County Road N; Yelp says 4505
  County Rd N, Marathon City. Draft uses WPR's.
- **Wiggly Field**: WPR says Schofield; Visit Wausau says Weston. Draft
  uses WPR's.
- **Eagle's Club**: fraternal club — `vfw_legion` is the nearest existing
  venue_type.

## In WPR's guide but left out of the draft

Outside Marathon County (the product's stated scope) — include them if the
scope grows:
Ballyhoos (Merrill), Les & Jim's Lincoln Lanes (Merrill), Red Granite Bar &
Grill (Merrill), Rachel's Roadside Bar & Grill (Wittenberg), Chet & Emil's
(Birnamwood).

St. Anne's Parish (Wausau) is in-county but omitted: no church/community
`venue_type` exists yet, and parish fries are typically Lenten-only. Add a
venue_type to the contract (build.py enum + FilterBar label) if church
fries should be listed.

## Method note

Roster and details came from reading public editorial sources — WPR's own
guide first. No Google Maps/Yelp bulk scraping (against their terms, and
the data quality isn't newsroom-grade anyway). Fish, prices, and hours
mostly live in Facebook photo menus, which is why the human verification
pass exists.
