#!/usr/bin/env python3
"""Weekly link checker for reader-facing listing links.

Deliberately separate from the hourly data build: a venue's website going
down for an afternoon shouldn't fail data builds, but curators should hear
about links that are actually dead. Checks website and menu_url on active
rows (photos are already cached at build time, so a dead photo source
doesn't affect readers).

Usage:
    python build/check_links.py <csv_url_or_path>

Prints a markdown report to stdout. Exit code 1 if any link failed, 0 if all
links are healthy — the workflow uses the exit code to decide whether to
file an issue.
"""

import csv
import io
import sys
from pathlib import Path

import requests

USER_AGENT = "wpr-fish-fry-linkcheck/1.0 (Wausau Pilot & Review civic widget)"
CHECK_COLUMNS = ("website", "menu_url")


def load_rows(source: str) -> list[dict]:
    if source.startswith(("http://", "https://")):
        resp = requests.get(source, timeout=30)
        resp.raise_for_status()
        text = resp.content.decode("utf-8-sig")
    else:
        text = Path(source).read_text(encoding="utf-8-sig")
    return [
        {k: (v or "").strip() for k, v in row.items() if k is not None}
        for row in csv.DictReader(io.StringIO(text))
    ]


def check(url: str) -> str | None:
    """Return None if the URL is healthy, else a short failure reason."""
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.head(url, timeout=15, allow_redirects=True, headers=headers)
        # Some servers reject HEAD outright; give them a GET before judging.
        if resp.status_code >= 400:
            resp = requests.get(url, timeout=15, allow_redirects=True, headers=headers)
        if resp.status_code >= 400:
            return f"HTTP {resp.status_code}"
        return None
    except requests.RequestException as e:
        return type(e).__name__


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python build/check_links.py <csv_url_or_path>", file=sys.stderr)
        sys.exit(2)

    failures: list[tuple[str, str, str, str]] = []
    checked = 0
    for row in load_rows(sys.argv[1]):
        if row.get("active") != "TRUE":
            continue
        for col in CHECK_COLUMNS:
            url = row.get(col, "")
            if not url:
                continue
            checked += 1
            reason = check(url)
            if reason:
                failures.append((row["venue_name"], col, url, reason))

    if not failures:
        print(f"All {checked} listing link(s) are healthy.")
        return

    print(f"## {len(failures)} dead link(s) in fish fry listings\n")
    print("| Venue | Column | URL | Problem |")
    print("|---|---|---|---|")
    for venue, col, url, reason in failures:
        print(f"| {venue} | `{col}` | {url} | {reason} |")
    print("\nFix the URL in the sheet or clear the cell.")
    sys.exit(1)


if __name__ == "__main__":
    main()
