"""
Load album metadata from CoTS album details TSV.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


def format_album_display_name(title: str, subtitle: str) -> str:
    """Build human-readable album name, e.g. 'Red (Taylor's Version)'."""
    title = title.strip()
    subtitle = subtitle.strip()
    if subtitle:
        return f"{title} ({subtitle})"
    return title


def load_album_metadata(path: Path) -> dict[str, dict[str, Any]]:
    """
    Load album lookup keyed by album code.

    Returns dict[album_code] -> { album_code, album_title, album_subtitle,
                                  album_name, year }
    """
    if not path.exists():
        raise FileNotFoundError(f"Album metadata file not found: {path}")

    lookup: dict[str, dict[str, Any]] = {}

    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            code = row["Code"].strip('"')
            title = row["Title"].strip('"')
            subtitle = row.get("SubTitle", "").strip('"')
            year_raw = row.get("Year", "").strip('"')

            year: int | None = None
            if year_raw:
                try:
                    year = int(year_raw)
                except ValueError:
                    year = None

            lookup[code] = {
                "album_code": code,
                "album_title": title,
                "album_subtitle": subtitle,
                "album_name": format_album_display_name(title, subtitle),
                "year": year,
            }

    return lookup
