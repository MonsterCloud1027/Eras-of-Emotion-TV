#!/usr/bin/env python3
"""
Generate a test dataset with NRCLex emotion scores (no Ollama).

Reads:  data/parsed_lyrics_sections.json
Writes: data/Test.json
Also:   data/song_emotion_wheel_data.test.json
        data/section_emotion_wheel_data.test.json

Requires: pip install NRCLex
          python -m textblob.download_corpora  (first run only)
"""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from nrclex import NRCLex

from helper.emotion_scorer import EMOTION_KEYS
from helper.emotion_wheel import (
    SECTION_WHEEL_TEST_JSON,
    SONG_WHEEL_TEST_JSON,
    build_song_and_section_wheel,
    export_json,
)

DEFAULT_SOURCE = Path(__file__).resolve().parent / "data" / "parsed_lyrics_sections.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "data" / "Test.json"
DEFAULT_WHEEL_OUTPUT = SONG_WHEEL_TEST_JSON
DEFAULT_SECTION_WHEEL_OUTPUT = SECTION_WHEEL_TEST_JSON


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def nrclex_emotion_scores(text: str, *, decimals: int = 1) -> dict[str, float]:
    """
    Score lyric text with NRCLex and map NRC's 8 Plutchik emotions to [0, 1].

    Uses raw emotion counts for the 8 core dimensions only (ignores positive/negative),
    then normalizes by the strongest dimension so the top emotion is 1.0 when any match
    exists.
    """
    analyzer = NRCLex()
    lyric = (text or "").strip()
    if lyric:
        analyzer.load_raw_text(lyric)

    raw = analyzer.raw_emotion_scores if lyric else {}
    totals = {key: float(raw.get(key, 0)) for key in EMOTION_KEYS}
    peak = max(totals.values(), default=0.0)

    if peak == 0.0:
        scores = dict.fromkeys(EMOTION_KEYS, 0.0)
    else:
        scores = {key: _clamp01(totals[key] / peak) for key in EMOTION_KEYS}

    if decimals >= 0:
        scores = {key: round(value, decimals) for key, value in scores.items()}
    return scores


def build_test_dataset(
    source: dict,
    *,
    decimals: int = 1,
) -> dict:
    dataset = deepcopy(source)
    sections = dataset.get("sections", [])

    for index, section in enumerate(sections, start=1):
        section["emotion_scores"] = nrclex_emotion_scores(
            section.get("text", ""),
            decimals=decimals,
        )
        if index % 200 == 0 or index == len(sections):
            print(f"  scored {index}/{len(sections)} sections", flush=True)

    meta = dataset.setdefault("meta", {})
    meta["emotion_scoring"] = {
        "mode": "nrclex",
        "decimals": decimals,
        "description": "NRCLex lexicon scores mapped to Plutchik 8 emotions (test data)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_sections": len(sections),
    }

    return dataset


def build_wheel_data(dataset: dict) -> tuple[list[dict], list[dict]]:
    return build_song_and_section_wheel(dataset)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Test.json with NRCLex emotion scores and aggregate to wheel JSON."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--wheel-output",
        type=Path,
        default=DEFAULT_WHEEL_OUTPUT,
        help="Song-level wheel JSON (test / NRCLex)",
    )
    parser.add_argument(
        "--section-wheel-output",
        type=Path,
        default=DEFAULT_SECTION_WHEEL_OUTPUT,
        help="Section-level wheel JSON (test / NRCLex)",
    )
    parser.add_argument(
        "--no-wheel",
        action="store_true",
        help="Skip song-level aggregation (only write section scores)",
    )
    parser.add_argument(
        "--decimals",
        type=int,
        default=1,
        help="Round scores to N decimal places (-1 for full float)",
    )
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Source file not found: {args.source}", file=sys.stderr)
        return 1

    with args.source.open(encoding="utf-8") as handle:
        source = json.load(handle)

    print(f"Scoring {len(source.get('sections', []))} sections with NRCLex ...", flush=True)
    dataset = build_test_dataset(source, decimals=args.decimals)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(dataset, handle, ensure_ascii=False, indent=2)

    example = dataset["sections"][0]
    print(f"Wrote {args.output.resolve()}")
    print(f"Sections: {len(dataset['sections'])}")
    print(f"Example emotion_scores: {json.dumps(example['emotion_scores'], indent=2)}")

    if not args.no_wheel:
        songs, sections = build_wheel_data(dataset)
        export_json(songs, args.wheel_output)
        export_json(sections, args.section_wheel_output)
        print(f"\nAggregated {len(songs)} songs -> {args.wheel_output.resolve()}")
        print(f"Sections {len(sections)} -> {args.section_wheel_output.resolve()}")
        if songs:
            song = songs[0]
            print(
                f"Example song: {song['song_title']} | primary={song['primary_emotion']} "
                f"score={song['primary_score']} | angle={song['angle']} deg r={song['radius']}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
