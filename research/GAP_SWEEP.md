# Category gap sweep — August 2026

A second-pass sweep aimed at **categories** rather than geography, after the
live data showed an implausible shape: 1 veterans hall and 3 supper clubs
out of 59 venues. Three agents swept veterans/fraternal halls, supper and
country clubs, and Wausau-metro venues the original Lenten-guide source
would have missed.

Result: **38 new candidates** in `fish_fry_gap_candidates.csv` (16 with a
confirmed Friday fry, 22 needing a phone call), plus several useful
negative findings. Every row is `active=FALSE`.

## The headline miss

**Edwin Memorial Lanes (EML), Rozellville** — *tied with Cassel Bar & Grill
for best fish fry in Marathon County* in a WAOW viewers' poll, and absent
from the guide since day one. The WAOW article surfaced in the very first
search run on this project; Cassel's details were taken from it and the
other half of the tie was never chased. Fish fry with choice of potato
including potato pancakes, slaw and a roll.

## Other real finds

- **Greenwood Hills Country Club** (Wausau) — its own menu page lists a
  4–9 PM Friday Fish Fry, and reviewers say the clubhouse restaurant is
  open to the public. Confirm public access on the call.
- **Bunkers at Tribute Golf Course** (Wausau) — clubhouse restaurant at a
  *municipal* course, so genuinely public. **Bluegill** fry, which is rare
  in the metro and would stand out in the fish filter.
- **Dale's Weston Lanes** — 60-lane bowling center running "Fish Fry
  Fridays"; owner sits on the Marathon County Tavern League board.
- **Coral Lanes** (Rothschild), **Wittenberg Lanes** — bowling centers with
  full kitchens and confirmed fries.
- **Aftershock, Bob & Randy's, Hutch's, Malarkey's, Blue Willow Cafe** —
  Wausau venues on the *competing* wausaufishfryguide.com but not ours.
- **American Legion Post 469** (Marathon City) — weekly public Friday
  Night Supper, $14, takeouts. The menu **rotates**, so fish some weeks and
  a cheeseburger sub others. Held out of the CSV: no street address could
  be sourced, and the 311 Walnut St in directories is the village
  municipal center, not the hall.

## The most interesting calls

**Christine's Bar** and **Moua's Callon Street Pub** (Wausau) — Hmong- and
Lao-owned neighborhood taverns with kitchens, on no fish fry guide
anywhere. If either runs a Friday fry it is both a distinctive listing and
arguably a story.

## Useful negative findings

The "only one veterans hall" shape was **not** a research gap — it is the
reality. Most Marathon County Legion posts have no clubhouse at all:

- Post 10 (Wausau) — no bar or restaurant; does veteran meal *delivery*.
- Post 492 (Rothschild) — meets in the village hall; no building.
- Post 4 (Athens), Post 298 (Spencer), Post 393 (Edgar), Post 502
  (Wittenberg) — meeting-only posts in municipal buildings.
- **Wausau Elks #248** — select Fridays only, members-and-guests, and the
  dinner is *catered by Hoehn's Huddle*, already in the guide.
- **Wausau Country Club** — famous Friday fry, but genuinely members-only.
  Deliberately excluded.
- **Knights of Columbus, Antigo** — listings describe a great public fry;
  the venue is **permanently closed** and is now a dance studio. Recorded
  so a future sweep doesn't re-find it.

In-county halls still worth one call each: **Burns VFW Post 388** (Wausau —
has a bar, kitchen and hall, runs public bingo), **Stratford VFW 6352**
(runs public steak feeds), **Mosinee/Peplin VFW 8280**.

## Two process corrections

1. **Exclusion lists must come from the whole sheet, not the live data.**
   This sweep returned 2510 Restaurant and Arrow Sports Club as new finds —
   both venues the curator had just removed. Live data omits inactive rows,
   so the agents went looking for exactly what had been taken down. Both
   were dropped by hand. (Note the external sources still list both as
   open, which says the removals were ahead of the internet, not behind it.)
2. **A competing guide exists**: wausaufishfryguide.com publishes a
   Marathon County fish fry page. Worth the newsroom knowing, both as a
   source and as context for what this tool needs to do better — map,
   filters, distance search, and sponsor tiers are all differentiators.

## Out-of-footprint

Six candidates sit well outside the Wausau area — Neillsville and Loyal
(Clark), Greenwood, Tomahawk and Medford. **American Legion Post 73**
(Neillsville) is the single best-documented hall fry found anywhere in the
sweep, weekly and year-round, but it is ~50 minutes from Wausau. Include
only if the guide's radius is meant to stretch that far.
