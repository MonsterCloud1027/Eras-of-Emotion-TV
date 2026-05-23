#!/usr/bin/env python3
"""
Build song- and section-level Plutchik emotion-wheel JSON.

NRCLex (test):  data/Test.json
LLM:            data/parsed_lyrics_sections_scored.json

Writes:
  data/song_emotion_wheel_data.test.json
  data/section_emotion_wheel_data.test.json
  data/song_emotion_wheel_data.llm.json
  data/section_emotion_wheel_data.llm.json
  data/song_emotion_wheel_data.json  (copy of LLM songs, frontend default)
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from helper.emotion_wheel import (
    DATA_DIR,
    DEFAULT_LLM_SCORED_JSON,
    DEFAULT_TEST_JSON,
    SECTION_WHEEL_LLM_JSON,
    SECTION_WHEEL_TEST_JSON,
    SONG_WHEEL_LLM_JSON,
    SONG_WHEEL_TEST_JSON,
    build_song_and_section_wheel,
    export_json,
)


def _write_preset(
    *,
    label: str,
    source: Path,
    song_output: Path,
    section_output: Path,
) -> tuple[int, int]:
    with source.open(encoding="utf-8") as handle:
        dataset = json.load(handle)

    songs, sections = build_song_and_section_wheel(dataset)
    export_json(songs, song_output)
    export_json(sections, section_output)

    print(f"[{label}] source: {source.resolve()}")
    print(f"  songs    -> {song_output.resolve()} ({len(songs)})")
    print(f"  sections -> {section_output.resolve()} ({len(sections)})")
    return len(songs), len(sections)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build test + LLM song/section emotion-wheel JSON."
    )
    parser.add_argument(
        "--preset",
        choices=("test", "llm", "all"),
        default="all",
        help="Which scoring source to export (default: all)",
    )
    parser.add_argument("--test-source", type=Path, default=DEFAULT_TEST_JSON)
    parser.add_argument("--llm-source", type=Path, default=DEFAULT_LLM_SCORED_JSON)
    parser.add_argument(
        "--frontend-alias",
        type=Path,
        default=DATA_DIR / "song_emotion_wheel_data.json",
        help="Copy LLM song JSON here for legacy DATA_URL",
    )
    parser.add_argument(
        "--max-debug",
        type=int,
        default=0,
        help="Print first N LLM songs after build (0 = none)",
    )
    args = parser.parse_args()

    if args.preset in ("test", "all"):
        if not args.test_source.exists():
            print(f"Test source not found: {args.test_source}", flush=True)
            return 1
        _write_preset(
            label="test",
            source=args.test_source,
            song_output=SONG_WHEEL_TEST_JSON,
            section_output=SECTION_WHEEL_TEST_JSON,
        )

    if args.preset in ("llm", "all"):
        if not args.llm_source.exists():
            print(f"LLM source not found: {args.llm_source}", flush=True)
            return 1
        song_count, _ = _write_preset(
            label="llm",
            source=args.llm_source,
            song_output=SONG_WHEEL_LLM_JSON,
            section_output=SECTION_WHEEL_LLM_JSON,
        )
        shutil.copy2(SONG_WHEEL_LLM_JSON, args.frontend_alias)
        print(f"  frontend -> {args.frontend_alias.resolve()} (LLM alias)")

        if args.max_debug > 0:
            with SONG_WHEEL_LLM_JSON.open(encoding="utf-8") as handle:
                songs = json.load(handle)
            print(f"\nFirst {min(args.max_debug, song_count)} LLM songs:\n")
            for song in songs[: args.max_debug]:
                print(
                    f"{song['song_title']} | primary={song['primary_emotion']} "
                    f"score={song['primary_score']} | angle={song['angle']}° "
                    f"r={song['radius']} | x={song['x']} y={song['y']}"
                )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
