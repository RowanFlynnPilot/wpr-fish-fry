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
PHOTO_MAX_WIDTH = 1200
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

VENUE_TYPES = {"restaurant", "supper_club", "bar", "vfw_legion"}
TIERS = {"free", "standard", "featured"}
FISH = {"perch", "cod", "walleye", "bluegill", "haddock", "smelt", "shrimp"}


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


def validate(rows: list[dict]) -> list[dict]:
    errors: list[str] = []
    venues: list[dict] = []
    featured_labels: list[str] = []
    seen_names: dict[str, int] = {}

    for r in rows:
        label = f"Row {r['_row']} ({r['venue_name'] or 'no venue_name'})"
        row_errors: list[str] = []

        for col in REQUIRED:
            if not r[col]:
                row_errors.append(f"{label}: required column '{col}' is empty")

        name_key = r["venue_name"].lower()
        if r["venue_name"]:
            if name_key in seen_names:
                row_errors.append(
                    f"{label}: duplicate venue_name — already used on row {seen_names[name_key]}"
                )
            else:
                seen_names[name_key] = r["_row"]

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
            if r[col] and not r[col].startswith(("http://", "https://")):
                row_errors.append(
                    f"{label}: {col} must start with http:// or https:// (got '{r[col]}')"
                )

        # The business model, enforced in code: free rows don't get paid features.
        if r["tier"] == "free":
            populated = [c for c in PAID_ONLY_COLUMNS if r[c]]
            if populated:
                row_errors.append(
                    f"{label}: free-tier row has paid-tier column(s) populated: "
                    f"{', '.join(populated)} — upgrade the tier or clear the cells"
                )

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
            resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
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


def write_step_summary(active: list[dict], warning: str | None) -> None:
    """In CI, hand the curators a build recap and a ready-to-paste featured
    blurb in the Actions run summary. No-op locally."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [f"## Fish fry build — {len(active)} active venue(s)", ""]
    if warning:
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
    venues = validate(rows)

    active = [v for v in venues if v["active"]]
    for v in active:
        del v["active"]
    geocode(active)
    process_photos(active)
    active.sort(key=lambda v: v["venue_name"].lower())

    # Curator typo detector: a sharp drop in active venues is more often a
    # sheet mistake than a wave of seasonal closures. Warn, don't fail —
    # closures are legitimate and the curators can judge.
    warning = None
    prev_count = previous_venue_count()
    if prev_count and prev_count >= 5 and len(active) < prev_count * 0.7:
        warning = (
            f"Active venue count dropped from {prev_count} to {len(active)} since "
            "the last build. If that isn't intentional (seasonal closures), check "
            "the sheet's 'active' column."
        )
        print(f"WARNING: {warning}", file=sys.stderr)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "venue_count": len(active),
        "venues": active,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_step_summary(active, warning)
    print(
        f"Build OK — {len(active)} active venue(s), "
        f"{len(venues) - len(active)} inactive → {OUTPUT_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
