# County expansion sweep — July 2026

`fish_fry_county_candidates.csv` (delivered to Rowan; regenerate from
`county_*.json` in this folder) holds **86 candidate venues** found by a
four-agent sweep of the Marathon County communities the guide didn't cover.
Every row is `active=FALSE` with a `CANDIDATE - verify before activating`
note, so nothing publishes until a human says so.

Current guide: 59 venues, concentrated in Wausau (29), Mosinee, Schofield,
Rothschild, Weston. This sweep targeted everything else.

## What came back

| | count |
|---|---|
| Candidates found | 86 |
| Friday fish fry **confirmed** by a source | 53 |
| Needs a phone call (promising, unconfirmed) | 33 |
| In Marathon County | 59 |
| Outside (Lincoln, Clark, Shawano) | 27 |

New communities reached: Athens, Edgar, Stratford, Fenwood, Kronenwetter,
Spencer, Elderon, Aniwa, Eland, Colby, Abbotsford, Dorchester, Unity,
Birnamwood, Wittenberg/Galloway — plus more of Marathon City, Mosinee,
Hatley, Ringle and Merrill.

## The scope decision (needs Rowan/Shereen)

27 candidates sit **outside** Marathon County:
- **Lincoln County (Merrill, 9)** — including Schult's Country Inn, named
  best fish fry in the Northwoods by WAOW (Fridays only, cash only), and
  Ballyhoos. Note the guide already features Red Granite, a Merrill venue.
- **Clark County (Colby, Abbotsford, Dorchester, Unity — 14)** — these
  towns straddle the county line; some addresses are on the Clark side.
- **Shawano County (Birnamwood, Eland, Aniwa — 4)** — including
  Chet & Emil's, which is in WPR's own Lenten guide.

Three coherent options:
1. **Marathon County only** → 59 candidates. Cleanest editorial line, but
   would mean dropping Red Granite (currently the featured venue).
2. **Marathon + the towns WPR's own Lenten guide already covers** →
   adds Merrill and Birnamwood. Matches existing newsroom practice.
3. **Everything** → 86 candidates, "the Wausau area and beyond."

## Standouts

- **ReLocation Pub and Eatery** (Kronenwetter) — the village's own news
  page documents a "World Famous" Friday fry drawing ~400 people weekly.
  It was in WPR's Lenten guide under a Rothschild address and was missed
  in the original import. Kronenwetter had zero listings until now.
- **Ashley Tavern & Ballroom** (Mosinee) — serving since 1926, publishes
  its full fish fry with prices. Cleanest data in the sweep.
- **Buck-A-Neer Supper Club** (Rozellville) — 1800s blacksmith shop; the
  fireplace was the forge. Strong featured-slot story.
- **Rib River Ballroom** (Marathon City) — Friday fish fry *buffet*,
  $19.99 adults, but cancelled when the hall is booked privately, so its
  hours need a caveat.
- **Schult's Country Inn** (Merrill, Lincoln Co) — best fish fry in the
  Northwoods per WAOW; open Fridays only, cash only.
- **Mama's Place** (Elderon) — five species including bluegill.

## Data-quality catches

- **Clubhouse Bar & Grill is stale.** The Ringle venue in the guide has
  been renamed repeatedly (Farley's → Clubhouse → Prost Hill → **Hillside
  Pub**), and the guide's address `R13085 County Rd N` is the
  pre-renumbering form of `167585 County Road N`. Same phone throughout.
  Rename the existing row rather than adding a new one.
- **Colby VFW Post 2227** runs a **Lenten-only** fry — belongs
  `active=FALSE` outside Lent, or needs a seasonal note.
- **Trucks Place** (Birnamwood): fish fry attested, but no source confirms
  it's specifically Friday.
- Several venues have **conflicting phone numbers or addresses** across
  directories; those are named in each row's editor_note. Two rows have
  phone deliberately left blank because the only number found belonged to
  a different business (Kathy & Cal's, Pub 1638).

## Method

Sources: Tavern League of Wisconsin directory, village/chamber business
directories, venue websites and Facebook pages, Travel Wisconsin, Visit
Wausau, WAOW/WSAW coverage, and restaurant aggregators. Agents were told
to leave a field empty rather than guess, and to flag rather than drop
venues where a fish fry couldn't be confirmed.

Placeholders in the CSV, same as the original import: `fish` defaults to
`cod`, prices to `$10–20`, hours to "Fri (call to confirm)" when unknown.
Real values found during research are already filled in.

## If this ships

At ~90–145 venues the single alphabetical list gets unwieldy. Recommend
adding a **city filter** (chips like the fish filters, generated from the
data) in the same change that activates a large batch.

## Lincoln County goes in whole (2026-08, Rowan's call)

The tri-county sweep gated `active` on a 45-mile readership radius. Lincoln
is now exempt from that gate: Merrill and Tomahawk are WPR's own northern
beat, so distance stopped being the deciding factor there. Clark and Shawano
still honour the radius, and every held row keeps its `[NN mi from Wausau]`
prefix so widening further stays a selection job, not a research job.

That took Lincoln from 16 rows to **21 of its 23**. Five cleared on a
follow-up pass that chased exactly what the sweep left blank:

| venue | what was missing | what the follow-up found |
|---|---|---|
| Shorthorns Bar & Grill | hours | Fri 9AM-11PM, and **walleye** — a real species, not the cod default |
| WT Silverado | hours | Fri 11AM-2AM, **perch and walleye** |
| Bottoms Up Bar & Grill | hours | Fri 11AM-11PM |
| Club X to C | hours | Fri 3PM-10PM dining room, off the venue's own site |
| Pine Ridge Restaurant | hours | Fri 5AM-10PM — full restaurant day, *not* the fry window; flagged in its editor_note |

Two stay `active=FALSE`, both because the fry itself is unconfirmed rather
than because of distance: **Bill's Bar** (Merrill) and **My Place at River's
Edge** (Tomahawk, kitchen hours known, fry not attested). One call each
settles them.

Also fixed in passing: **Winding Trail**'s website in the sweep
(`windingtrailgrillbar.com`) does not resolve — the live site is
`windingtrailbar.com`, which also yielded its sides (rye bread, coleslaw).

Northwoods menus are overwhelmingly **photographs of paper**, so species
often can't be read off the web at all. Rows carrying the `cod` placeholder
now say so in editor_note (`FISH SPECIES UNVERIFIED - defaulted to cod`)
rather than letting a guess read as sourced fact.
