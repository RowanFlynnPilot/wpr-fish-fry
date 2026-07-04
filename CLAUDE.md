# wpr-fish-fry — Friday Fish Fry Finder

Map + filterable list of every Friday fish fry in Marathon County, published by
the Wausau Pilot & Review. Sponsor-acquisition product: free basic listings,
paid tiers (standard/featured) for photos, descriptions, menu links, and the
weekly featured slot.

## Architecture

```
Google Sheet (published CSV, curated by Shereen/Devon)
        │
        ▼
build/build.py            ← validate contract, geocode + fetch photos via committed caches
        │
        ▼
widget/public/data/fish_fry.json     ← static JSON, the only data artifact
widget/public/photos/                ← cached sponsor photos (committed)
        │
        ▼
widget/ (Vite + React 18 + Leaflet)  ← npm run build
        │
        ▼
GitHub Pages (/wpr-fish-fry/)        ← WordPress iframe embed (snippet in README.md)
```

GitHub Actions runs the whole chain hourly (`.github/workflows/build.yml`),
plus on push to main and on manual dispatch.

## The contract

One row per venue in the sheet. The header is a contract: all 20 columns must
exist, no extras. `sample/fish_fry_sample.csv` is the canonical template —
copy it into a new Google Sheet to start.

| column | rule |
|---|---|
| venue_name | required, unique |
| venue_type | required, enum: `restaurant` `supper_club` `bar` `vfw_legion` |
| address, city | required — geocoded at build, never edit coordinates in the sheet |
| phone, website | optional |
| fish | required, comma-separated from: perch, cod, walleye, bluegill, haddock, smelt, shrimp |
| price_low, price_high | required, numeric, low ≤ high |
| sides, hours | sides optional, hours required — both free text |
| all_you_can_eat, takeout, featured_this_week, active | exactly `TRUE` or `FALSE`, nothing else |
| tier | required, enum: `free` `standard` `featured` |
| description, photo_url, menu_url | **paid tiers only** — populated on a `free` row fails the build |
| featured_this_week | `TRUE` on at most one row, and that row must be tier `featured` |
| editor_note | optional |
| active | `FALSE` keeps seasonal closures in the sheet without publishing them |

Any violation fails the build. The Actions run goes red and the log names the
sheet row and venue with a plain-English fix. That red run **is** the feedback
loop for the curators — do not soften it with fallbacks or silent stripping.

## Geocoding — one mechanism

The sheet never holds coordinates. `build.py` geocodes active venues through
Nominatim (1 req/sec, identified User-Agent) into `data/geocode_cache.json`,
keyed by normalized address (`lowercase, single-spaced, "address, city"`).
The cache is committed; CI commits updates back with `[skip ci]`. Subsequent
builds are cache-only and deterministic.

Wrong pin? Edit the cache entry's lat/lon directly. One file, one fix.
Geocode failure on an active row fails the build with the exact cache key to
add manually.

## Photos — same mechanism

Sponsor photos are fetched once into `data/photo_cache.json` +
`widget/public/photos/` (resized to ≤1200px JPEG, committed, keyed by source
URL) and served from Pages, so a paid listing never ships a broken image
because the venue's own site died. Change `photo_url` in the sheet to refresh
a photo. Fetch failure on an active paid row fails the build.

## Ops around the build

- The Actions run summary carries a build recap and a copy-paste newsletter
  blurb for the weekly featured venue (`write_step_summary` in build.py).
- A sharp drop in active venue count warns (build log + summary) but does not
  fail — seasonal closures are legitimate.
- `.github/workflows/linkcheck.yml` runs `build/check_links.py` weekly against
  `website`/`menu_url` and files/updates a GitHub issue on dead links.
  Deliberately separate from the hourly build: third-party outages are not
  data errors.
- `.github/workflows/featured-reminder.yml` runs `build/check_featured.py`
  Thursday mornings and files an issue if no active venue holds the paid
  featured slot for the coming Friday.
- `build/tests/` pins the sheet-contract validation rules; CI runs them
  before every data build.
- The widget shows a "call ahead" stale-data notice when `generated_at` is
  older than 26 hours — the reader-facing symptom of a silently broken
  pipeline.
- `widget/public/embed-test.html` fakes a WordPress article around the
  widget to demo the iframe auto-height contract end to end.

## Commands (PowerShell)

```powershell
# data build against the sample (or paste the sheet CSV URL)
python build/build.py sample/fish_fry_sample.csv

# widget dev server / production build
cd widget; npm install; npm run dev
cd widget; npm run build
```

## Setup (once)

1. Push this repo to `RowanFlynnPilot/wpr-fish-fry`.
2. Create the Google Sheet from `sample/fish_fry_sample.csv`; File → Share →
   Publish to web → CSV.
3. Repo Settings → Secrets and variables → Actions → Variables → add
   `SHEET_CSV_URL` with the published URL.
4. Settings → Pages → Source: **GitHub Actions**.
5. Run the workflow once via `workflow_dispatch`; embed
   `https://rowanflynnpilot.github.io/wpr-fish-fry/` as a WordPress iframe.

## Business rules living in code

- Free tier renders: name, type, fish, price, hours, sides, phone, directions,
  website. Standard adds photo, description, menu link. Featured adds
  eligibility for the weekly slot. Enforced in `build.py`, rendered in
  `VenueCard.jsx`.
- Default list order is alphabetical — paid tiers win on visual richness,
  never position. Reader-initiated sorts ("Nearest me", "Price") are the only
  exceptions, and they apply to everyone equally.
- The featured slot is pinned above the list, ignores filters (it's paid
  placement), and is excluded from the list so it never renders twice. On the
  map, the featured venue's marker gets a black ring — no logo on the map
  (editorial decision, 2026-07).
- "Sponsor" tag wording in `App.jsx`/`VenueCard.jsx` is placeholder pending
  Shereen's disclosure language.
- `FishGuide.jsx` holds the editorial "Know Your Fry" guide, keyed to the
  FISH enum in build.py. It renders only species present in the live data —
  when adding a species to the enum, add its guide entry in the same change.

## Branding

Matches wausaupilotandreview.com: Oswald (display) + Merriweather (body),
black-on-white newspaper palette. The teal (`--teal: #3a867c`) is the
typewriter in the WPR badge and is the only accent color. Badge assets live in
`widget/public/brand/` (pulled from
`wausaupilotandreview.com/wp-content/uploads/2024/04/cropped-Wausau-Pilot-Transparent-*.png`;
swap in a higher-res original if the newsroom supplies one).

## Embed contract

The widget posts `{ type: "wpr-fish-fry:height", height }` to its parent on
resize; the WordPress snippet in README.md sizes the iframe from it. Don't
rename the message type without updating the embed on the WordPress side.

## Principles

One correct path, no fallbacks. Fail fast and loud. Surgical changes only.
Fix root causes. The sheet is either correct or the build says exactly why not.
