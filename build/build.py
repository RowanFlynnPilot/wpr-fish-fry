#!/usr/bin/env python3
"""
wpr-fish-fry build script.

One correct path: fetch the published sheet CSV, validate the full contract,
geocode active venues through the committed cache, write static JSON for the
widget. Any contract violation fails the build with sheet row numbers and
venue names so a non-technical curator can fix the sheet without help.

Usage:
    python build/build.py <csv_url_or_path>

The single argument is either the Google Sheet published-CSV URL (CI) or a
local CSV path (development / sample data). Same code path either way.
"""

import csv
import hashlib
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image

# Windows consoles default to cp1252; don't let an unprintable arrow crash a
# build that already succeeded. CI is UTF-8 and unaffected.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")

ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = ROOT / "data" / "geocode_cache.json"
PHOTO_MANIFEST_PATH = ROOT / "data" / "photo_cache.json"
PHOTO_DIR = ROOT / "widget" / "public" / "photos"
PHOTO_INBOX_DIR = ROOT / "photos-inbox"
PHOTO_MAX_WIDTH = 1200
LOGO_INBOX_DIR = ROOT / "logos-inbox"
LOGO_DIR = ROOT / "widget" / "public" / "logos"
LOGO_MAX_DIM = 128

# photo_url is either a full http(s) URL or the bare filename of an image
# committed to photos-inbox/ (the email-me-a-photo workflow).
INBOX_FILENAME_RE = re.compile(r"^[\w][\w .()-]*\.(jpe?g|png|webp)$", re.IGNORECASE)
OUTPUT_PATH = ROOT / "widget" / "public" / "data" / "fish_fry.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "wpr-fish-fry/1.0 (Wausau Pilot & Review civic widget)"

COLUMNS = [
    "venue_name", "venue_type", "address", "city", "phone", "website",
    "fish", "price_low", "price_high", "sides", "hours", "all_you_can_eat",
    "takeout", "tier", "description", "photo_url", "menu_url",
    "featured_this_week", "editor_note", "active",
]
REQUIRED = [
    "venue_name", "venue_type", "address", "city", "fish",
    "price_low", "price_high", "hours", "tier",
]
BOOLEAN_COLUMNS = ["all_you_can_eat", "takeout", "featured_this_week", "active"]
URL_COLUMNS = ["website", "photo_url", "menu_url"]
PAID_ONLY_COLUMNS = ["description", "photo_url", "menu_url"]

# County is derived from city rather than carried as a 21st sheet column —
# the mapping is deterministic and keeps the contract stable. Towns that
# straddle a county line (Colby, Abbotsford, Unity, Dorchester, Spencer)
# are assigned to the county holding their main business district; a few
# rural venues carry a mailing city from the neighboring county, and those
# are called out in their editor_note. A city missing here fails the build.
CITY_COUNTY = {
    # Marathon
    "wausau": "Marathon", "schofield": "Marathon", "weston": "Marathon",
    "rothschild": "Marathon", "mosinee": "Marathon", "kronenwetter": "Marathon",
    "hatley": "Marathon", "ringle": "Marathon", "marathon city": "Marathon",
    "athens": "Marathon", "edgar": "Marathon", "stratford": "Marathon",
    "fenwood": "Marathon", "spencer": "Marathon", "elderon": "Marathon",
    "rib mountain": "Marathon", "brokaw": "Marathon", "bevent": "Marathon",
    "knowlton": "Marathon", "rozellville": "Marathon",
    # Lincoln
    "merrill": "Lincoln", "tomahawk": "Lincoln",
    # Clark
    "colby": "Clark", "abbotsford": "Clark", "unity": "Clark",
    "dorchester": "Clark", "greenwood": "Clark", "neillsville": "Clark",
    # Shawano
    "birnamwood": "Shawano", "eland": "Shawano", "aniwa": "Shawano",
    "wittenberg": "Shawano", "tigerton": "Shawano",
    # Portage / Wood
    "stevens point": "Portage", "plover": "Portage", "junction city": "Portage",
    "marshfield": "Wood", "pittsville": "Wood",
    # Waupaca / Langlade
    "manawa": "Waupaca", "clintonville": "Waupaca", "antigo": "Langlade",
}

VENUE_TYPES = {"restaurant", "supper_club", "bar", "vfw_legion"}
TIERS = {"free", "standard", "featured"}
FISH = {"perch", "cod", "walleye", "bluegill", "haddock", "smelt", "shrimp", "flounder"}


def die(errors: list[str]) -> None:
    print(f"BUILD FAILED — {len(errors)} problem(s) in the sheet:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    sys.exit(1)


def normalize_address(address: str, city: str) -> str:
    """Cache key. Manual cache fixes must use this exact form:
    lowercase, single-spaced, 'address, city'."""
    return " ".join(f"{address}, {city}".lower().split())


def load_csv(source: str) -> list[dict]:
    if source.startswith(("http://", "https://")):
        resp = requests.get(source, timeout=30)
        resp.raise_for_status()
        text = resp.content.decode("utf-8-sig")
    else:
        text = Path(source).read_text(encoding="utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))
    header = reader.fieldnames or []
    errors = []
    missing = [c for c in COLUMNS if c not in header]
    unknown = [c for c in header if c is not None and c not in COLUMNS]
    if missing:
        errors.append(f"Header: missing column(s): {', '.join(missing)}")
    if unknown:
        errors.append(
            f"Header: unknown column(s): {', '.join(unknown)} — "
            "the header is a contract; fix the column name, don't invent new ones"
        )
    if errors:
        die(errors)

    rows = []
    for i, raw in enumerate(reader, start=2):  # sheet numbering: header is row 1
        if raw.get(None):
            errors.append(f"Row {i}: has more cells than the header has columns")
            continue
        values = {k: (v or "").strip() for k, v in raw.items() if k is not None}
        if not any(values.values()):
            continue  # fully empty row — Sheets exports trailing blanks
        values["_row"] = i
        rows.append(values)
    if errors:
        die(errors)
    if not rows:
        die(["Sheet has a valid header but zero data rows."])
    return rows


def parse_bool(value: str):
    return {"TRUE": True, "FALSE": False}.get(value)


def validate(rows: list[dict], warnings: list[str] | None = None) -> list[dict]:
    errors: list[str] = []
    venues: list[dict] = []
    featured_labels: list[str] = []
    seen_names: dict[str, int] = {}
    if warnings is None:
        warnings = []

    for r in rows:
        label = f"Row {r['_row']} ({r['venue_name'] or 'no venue_name'})"
        row_errors: list[str] = []

        for col in REQUIRED:
            if not r[col]:
                row_errors.append(f"{label}: required column '{col}' is empty")

        if r["city"] and r["city"].lower().strip() not in CITY_COUNTY:
            row_errors.append(
                f"{label}: city '{r['city']}' has no county assigned — add it to "
                "CITY_COUNTY in build.py (the county filter is built from it)"
            )

        name_key = r["venue_name"].lower()
        if r["venue_name"]:
            if name_key in seen_names:
                row_errors.append(
                    f"{label}: duplicate venue_name — already used on row {seen_names[name_key]}"
                )
            else:
                seen_names[name_key] = r["_row"]

        # Enum columns are case/spacing forgiving, same as `fish` already is:
        # "Bar" and "Supper Club" are unambiguous, so normalize rather than
        # bounce the curator. Anything genuinely unknown still fails below.
        r["venue_type"] = "_".join(r["venue_type"].lower().split())
        r["tier"] = r["tier"].lower().strip()

        if r["venue_type"] and r["venue_type"] not in VENUE_TYPES:
            row_errors.append(
                f"{label}: venue_type '{r['venue_type']}' is not one of {', '.join(sorted(VENUE_TYPES))}"
            )
        if r["tier"] and r["tier"] not in TIERS:
            row_errors.append(
                f"{label}: tier '{r['tier']}' is not one of {', '.join(sorted(TIERS))}"
            )

        fish = [f.strip().lower() for f in r["fish"].split(",") if f.strip()]
        bad_fish = sorted(set(fish) - FISH)
        if r["fish"] and bad_fish:
            row_errors.append(
                f"{label}: fish {', '.join(bad_fish)} not in allowed list "
                f"({', '.join(sorted(FISH))}) — check spelling, or add the species to FISH in build.py"
            )

        prices: dict[str, float] = {}
        for col in ("price_low", "price_high"):
            if r[col]:
                try:
                    prices[col] = float(r[col].lstrip("$"))
                except ValueError:
                    row_errors.append(f"{label}: {col} '{r[col]}' is not a number")
        if len(prices) == 2 and prices["price_low"] > prices["price_high"]:
            row_errors.append(f"{label}: price_low is greater than price_high")

        bools: dict[str, bool] = {}
        for col in BOOLEAN_COLUMNS:
            b = parse_bool(r[col])
            if b is None:
                row_errors.append(
                    f"{label}: {col} must be exactly TRUE or FALSE (got '{r[col]}')"
                )
            else:
                bools[col] = b

        for col in URL_COLUMNS:
            if not r[col] or r[col].startswith(("http://", "https://")):
                continue
            if col == "photo_url" and INBOX_FILENAME_RE.match(r[col]):
                continue  # photos-inbox/ filename — resolved at photo time
            hint = (
                " — or, for photo_url only, the filename of an image uploaded "
                "to photos-inbox/ (e.g. red-granite.jpg)"
                if col == "photo_url"
                else ""
            )
            row_errors.append(
                f"{label}: {col} must start with http:// or https:// "
                f"(got '{r[col]}'){hint}"
            )

        # The business model, enforced in code: free rows don't get paid
        # features. Paid content on a free row stays in the sheet (handy for
        # parking a lapsed sponsor's photo/description) but is stripped from
        # the published data — warned, not fatal, so a downgrade never forces
        # deleting data. If a NEW sponsor's photo isn't showing up, this
        # warning in the build summary is the first place to look.
        if r["tier"] == "free":
            populated = [c for c in PAID_ONLY_COLUMNS if r[c]]
            if populated:
                warnings.append(
                    f"{label}: free tier — {', '.join(populated)} kept in the "
                    "sheet but not published. Upgrade the tier to show them."
                )
                for c in populated:
                    r[c] = ""

        if bools.get("featured_this_week"):
            featured_labels.append(label)
            if r["tier"] != "featured":
                row_errors.append(
                    f"{label}: featured_this_week is TRUE but tier is '{r['tier']}' — "
                    "only featured-tier venues can hold the weekly slot"
                )

        errors.extend(row_errors)
        if row_errors:
            continue

        venues.append({
            "venue_name": r["venue_name"],
            "venue_type": r["venue_type"],
            "address": r["address"],
            "city": r["city"],
            "county": CITY_COUNTY[r["city"].lower().strip()],
            "phone": r["phone"],
            "website": r["website"],
            "fish": fish,
            "price_low": prices["price_low"],
            "price_high": prices["price_high"],
            "sides": r["sides"],
            "hours": r["hours"],
            "all_you_can_eat": bools["all_you_can_eat"],
            "takeout": bools["takeout"],
            "tier": r["tier"],
            "description": r["description"],
            "photo_url": r["photo_url"],
            "menu_url": r["menu_url"],
            "featured_this_week": bools["featured_this_week"],
            "editor_note": r["editor_note"],
            "active": bools["active"],
        })

    if len(featured_labels) > 1:
        errors.append(
            "featured_this_week is TRUE on more than one row: "
            + "; ".join(featured_labels)
            + " — exactly one venue holds the weekly slot"
        )

    if errors:
        die(errors)
    return venues


def geocode(venues: list[dict]) -> None:
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    dirty = False

    for v in venues:
        key = normalize_address(v["address"], v["city"])
        if key not in cache:
            time.sleep(1)  # Nominatim usage policy: max 1 request/second
            resp = requests.get(
                NOMINATIM_URL,
                params={
                    "q": f"{v['address']}, {v['city']}, Wisconsin, USA",
                    "format": "json",
                    "limit": 1,
                },
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            resp.raise_for_status()
            results = resp.json()
            if not results:
                errors.append(
                    f"Geocoding failed for active venue '{v['venue_name']}' — Nominatim has no match "
                    f"for '{v['address']}, {v['city']}'. Fix the address in the sheet, or add a manual "
                    f"entry to data/geocode_cache.json under the key '{key}'."
                )
                continue
            cache[key] = {
                "lat": round(float(results[0]["lat"]), 6),
                "lon": round(float(results[0]["lon"]), 6),
                "source": "nominatim",
                "geocoded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            dirty = True

        if key in cache:
            v["lat"] = cache[key]["lat"]
            v["lon"] = cache[key]["lon"]

    # Persist successful geocodes even if some addresses failed — a fixed
    # sheet shouldn't re-geocode venues that already resolved.
    if dirty:
        CACHE_PATH.write_text(
            json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    if errors:
        die(errors)


def process_photos(venues: list[dict]) -> None:
    """Sponsor photos are downloaded once into a committed cache and served
    from Pages, so a paid listing never ships a broken image because the
    venue's own site did. Keyed by source URL — change photo_url in the sheet
    to refresh the photo. Fetch failure fails the build: a paid tier with a
    dead photo is a product defect, not a warning."""
    manifest = (
        json.loads(PHOTO_MANIFEST_PATH.read_text(encoding="utf-8"))
        if PHOTO_MANIFEST_PATH.exists()
        else {}
    )
    errors: list[str] = []
    dirty = False
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)

    for v in venues:
        url = v["photo_url"]
        if not url:
            continue
        entry = manifest.get(url)
        if entry and (PHOTO_DIR / entry["file"]).exists():
            v["photo_url"] = f"photos/{entry['file']}"
            continue
        try:
            if url.startswith(("http://", "https://")):
                resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
                resp.raise_for_status()
                data = resp.content
            else:
                # Bare filename → the committed photos-inbox/ folder.
                inbox_file = PHOTO_INBOX_DIR / url
                if not inbox_file.exists():
                    raise FileNotFoundError(
                        f"no file named '{url}' in photos-inbox/ — upload it "
                        "there (GitHub: Add file → Upload files) or fix the "
                        "filename in the sheet"
                    )
                data = inbox_file.read_bytes()
            img = Image.open(io.BytesIO(data)).convert("RGB")
            if img.width > PHOTO_MAX_WIDTH:
                img = img.resize(
                    (PHOTO_MAX_WIDTH, round(img.height * PHOTO_MAX_WIDTH / img.width)),
                    Image.LANCZOS,
                )
            name = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16] + ".jpg"
            img.save(PHOTO_DIR / name, "JPEG", quality=82, optimize=True)
            manifest[url] = {
                "file": name,
                "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            v["photo_url"] = f"photos/{name}"
            dirty = True
        except Exception as e:
            errors.append(
                f"Photo fetch failed for '{v['venue_name']}' ({url}): {e} — "
                "fix the photo_url in the sheet or clear the cell."
            )

    # Persist successful fetches even if one photo failed, same as geocoding.
    if dirty:
        PHOTO_MANIFEST_PATH.write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    if errors:
        die(errors)


def venue_slug(name: str) -> str:
    """Must mirror venueSlug() in the widget (App.jsx) — logos are keyed by it."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower())


def process_logos(venues: list[dict]) -> None:
    """Optional small logos, curated by dropping files into logos-inbox/
    named by venue slug (e.g. red-granite-bar-grill.png). No sheet column:
    which venues get logos is a curation choice made in that folder. Absent
    file = no logo, never an error. Output dir is rebuilt every run so
    replaced or deleted inbox files flow through."""
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    for stale in LOGO_DIR.glob("*.png"):
        stale.unlink()
    for v in venues:
        slug = venue_slug(v["venue_name"])
        source = next(
            (
                p
                for ext in ("png", "jpg", "jpeg", "webp")
                if (p := LOGO_INBOX_DIR / f"{slug}.{ext}").exists()
            ),
            None,
        )
        if source is None:
            v["logo"] = ""
            continue
        img = Image.open(source)
        img.thumbnail((LOGO_MAX_DIM, LOGO_MAX_DIM))
        out = LOGO_DIR / f"{slug}.png"
        img.save(out, "PNG", optimize=True)
        v["logo"] = f"logos/{slug}.png"


def money(n: float) -> str:
    return f"${n:g}"


def featured_blurb(v: dict) -> str:
    """Copy-paste newsletter/social blurb for the weekly featured (paid) slot."""
    price = (
        money(v["price_low"])
        if v["price_low"] == v["price_high"]
        else f"{money(v['price_low'])}–{money(v['price_high'])}"
    )
    desc = f" {v['description']}" if v["description"] else ""
    return (
        f"🐟 **This week's featured Friday fish fry: {v['venue_name']}** "
        f"({v['city']}) — {', '.join(v['fish'])}; {price}; {v['hours']}.{desc} "
        f"Find every fish fry in Marathon County: "
        f"https://rowanflynnpilot.github.io/wpr-fish-fry/"
    )


def write_step_summary(active: list[dict], warnings: list[str]) -> None:
    """In CI, hand the curators a build recap and a ready-to-paste featured
    blurb in the Actions run summary. No-op locally."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [f"## Fish fry build — {len(active)} active venue(s)", ""]
    for warning in warnings:
        lines += [f"⚠️ {warning}", ""]
    featured = next((v for v in active if v["featured_this_week"]), None)
    if featured:
        lines += [
            f"### This week's featured fry: {featured['venue_name']}",
            "",
            "Copy-paste for the newsletter or socials:",
            "",
            f"> {featured_blurb(featured)}",
        ]
    else:
        lines += ["No venue holds the featured slot this week."]
    with open(summary_path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def previous_venue_count() -> int | None:
    if not OUTPUT_PATH.exists():
        return None
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8")).get("venue_count")
    except (json.JSONDecodeError, OSError):
        return None


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python build/build.py <csv_url_or_path>", file=sys.stderr)
        sys.exit(2)

    rows = load_csv(sys.argv[1])
    warnings: list[str] = []
    venues = validate(rows, warnings)

    active = [v for v in venues if v["active"]]
    for v in active:
        del v["active"]
    geocode(active)
    process_photos(active)
    process_logos(active)
    active.sort(key=lambda v: v["venue_name"].lower())

    # Curator typo detector: a sharp drop in active venues is more often a
    # sheet mistake than a wave of seasonal closures. Warn, don't fail —
    # closures are legitimate and the curators can judge.
    prev_count = previous_venue_count()
    if prev_count and prev_count >= 5 and len(active) < prev_count * 0.7:
        warnings.append(
            f"Active venue count dropped from {prev_count} to {len(active)} since "
            "the last build. If that isn't intentional (seasonal closures), check "
            "the sheet's 'active' column."
        )
    for warning in warnings:
        print(f"WARNING: {warning}", file=sys.stderr)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "venue_count": len(active),
        "venues": active,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_step_summary(active, warnings)
    print(
        f"Build OK — {len(active)} active venue(s), "
        f"{len(venues) - len(active)} inactive → {OUTPUT_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
