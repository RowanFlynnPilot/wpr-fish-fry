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
build/build.py            ← validate contract, geocode via committed cache
        │
        ▼
widget/public/data/fish_fry.json     ← static JSON, the only data artifact
        │
        ▼
widget/ (Vite + React 18 + Leaflet)  ← npm run build
        │
        ▼
GitHub Pages (/wpr-fish-fry/)        ← WordPress iframe embed
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
  never position.
- The featured slot is pinned above the list, ignores filters (it's paid
  placement), and is excluded from the list so it never renders twice.
- "Sponsor" tag wording in `App.jsx`/`VenueCard.jsx` is placeholder pending
  Shereen's disclosure language.

## Principles

One correct path, no fallbacks. Fail fast and loud. Surgical changes only.
Fix root causes. The sheet is either correct or the build says exactly why not.
