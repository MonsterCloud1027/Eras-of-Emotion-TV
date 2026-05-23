#!/usr/bin/env python3
"""
Preprocess Taylor Swift lyric corpus into visualization-ready JSON.

Output:
  data/parsed_lyrics_sections.json  — flat sections (+ meta, album_order)

Usage:
    python parse_lyrics.py
    python parse_lyrics.py --input path/to/lyrics.txt
    python parse_lyrics.py --input path/to/lyrics.tsv --output-dir data
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from helper.album_metadata import load_album_metadata
from helper.lyrics_parser import LyricParseError, read_lyric_file
from helper.section_builder import build_dataset, build_sections

# Default: CoTS flat lyric TSV (tab-separated; same ID format as TXT with space)
DEFAULT_INPUT = (
    Path(__file__).resolve().parent
    / "Corpus-of-Taylor-Swift-main"
    / "tsv"
    / "cots-lyric-details.tsv"
)
DEFAULT_ALBUMS = (
    Path(__file__).resolve().parent
    / "Corpus-of-Taylor-Swift-main"
    / "tsv"
    / "cots-album-details.tsv"
)
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data"


def run_pipeline(
    input_path: Path,
    output_dir: Path,
    albums_path: Path,
) -> dict:
    """Parse lyrics, build flat dataset, and write JSON output."""
    parsed_lines = list(read_lyric_file(input_path))
    if not parsed_lines:
        raise LyricParseError(f"No lyric lines found in {input_path}")

    album_lookup = load_album_metadata(albums_path)
    sections = build_sections(parsed_lines)
    dataset = build_dataset(sections, album_lookup)

    dataset["meta"]["source_file"] = str(input_path.resolve())
    dataset["meta"]["generated_at"] = datetime.now(timezone.utc).isoformat()

    output_dir.mkdir(parents=True, exist_ok=True)
    sections_path = output_dir / "parsed_lyrics_sections.json"

    with sections_path.open("w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    return dataset


def print_summary(dataset: dict) -> None:
    """Print pipeline statistics and one example section."""
    meta = dataset["meta"]
    print("\n=== Lyric preprocessing complete ===")
    print(f"Albums:   {meta['total_albums']}")
    print(f"Songs:    {meta['total_songs']}")
    print(f"Sections: {meta['total_sections']}")
    print(f"Lines:    {meta['total_lines']}")

    example = dataset["sections"][0]
    print("\n--- Example section object ---")
    print(json.dumps(example, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Parse Taylor Swift lyrics into section-based JSON for D3 visualization."
    )
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        default=DEFAULT_INPUT,
        help="Path to raw lyric TXT/TSV file",
    )
    parser.add_argument(
        "--albums",
        type=Path,
        default=DEFAULT_ALBUMS,
        help="Path to CoTS album metadata TSV",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for parsed_lyrics_sections.json",
    )
    args = parser.parse_args()

    try:
        dataset = run_pipeline(args.input, args.output_dir, args.albums)
    except (LyricParseError, FileNotFoundError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print_summary(dataset)
    print(f"\nWrote: {args.output_dir / 'parsed_lyrics_sections.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
