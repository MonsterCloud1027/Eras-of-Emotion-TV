#!/usr/bin/env python3
"""
Score emotion vectors for lyric sections using local Ollama (qwen3:8b).

Reads:  data/parsed_lyrics_sections.json
Writes: data/parsed_lyrics_sections_scored.json  (incremental, one section at a time)

Usage:
    python score_emotions.py
    python score_emotions.py --limit 5          # test first 5 pending sections
    python score_emotions.py --start-index 100  # skip first 100 (still resumes if scored)
    python score_emotions.py --reset            # delete output and score from section 1

Tip: Close parsed_lyrics_sections_scored.json in the editor while scoring
     (Windows may block file replace if the tab is open).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from helper.emotion_scorer import (
    DEFAULT_MODEL,
    DEFAULT_NUM_PREDICT,
    DEFAULT_OLLAMA_URL,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINK,
    MAX_ALL_ZERO_RETRIES,
    EmotionScoreError,
    run_scoring,
)

DEFAULT_SOURCE = Path(__file__).resolve().parent / "data" / "parsed_lyrics_sections.json"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parent / "data" / "parsed_lyrics_sections_scored.json"
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Score lyric sections with Ollama qwen3:8b (8 Plutchik emotions)."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Input sections JSON (unchanged)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON with emotion_scores added per section",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Ollama model name (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--ollama-url",
        default=DEFAULT_OLLAMA_URL,
        help="Ollama /api/generate endpoint",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Minimum section index to score (resume still skips scored sections)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of sections to score in this run",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing output and re-score all sections from the beginning",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=DEFAULT_TEMPERATURE,
        help=f"Ollama sampling temperature (default: {DEFAULT_TEMPERATURE})",
    )
    parser.add_argument(
        "--max-zero-retries",
        type=int,
        default=MAX_ALL_ZERO_RETRIES,
        help="Re-call Ollama when all emotion scores are 0.0 (default: %(default)s)",
    )
    parser.add_argument(
        "--num-predict",
        type=int,
        default=DEFAULT_NUM_PREDICT,
        help=f"Max tokens for Ollama response (default: {DEFAULT_NUM_PREDICT}; raise if think empties JSON)",
    )
    think_group = parser.add_mutually_exclusive_group()
    think_group.add_argument(
        "--think",
        action="store_true",
        default=None,
        help="Enable Qwen3 thinking mode (default: on)",
    )
    think_group.add_argument(
        "--no-think",
        action="store_true",
        help="Disable thinking mode",
    )
    args = parser.parse_args()
    use_think = DEFAULT_THINK if not args.no_think else False
    if args.think:
        use_think = True

    if not args.source.exists():
        print(f"Source file not found: {args.source}", file=sys.stderr)
        return 1

    try:
        if args.reset:
            print("Reset: removed previous scored output; starting from section 1.")

        dataset = run_scoring(
            args.source,
            args.output,
            model=args.model,
            base_url=args.ollama_url,
            start_index=args.start_index,
            limit=args.limit,
            reset=args.reset,
            temperature=args.temperature,
            think=use_think,
            num_predict=args.num_predict,
            max_zero_retries=args.max_zero_retries,
        )
    except (EmotionScoreError, FileNotFoundError, OSError, KeyboardInterrupt) as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        print(
            "Partial progress is saved in the output file. Re-run the same command to resume.",
            file=sys.stderr,
        )
        return 1

    meta = dataset["meta"].get("emotion_scoring", {})
    print("\n=== Emotion scoring ===")
    print(f"Model:   {meta.get('model')}")
    print(f"Temp:    {meta.get('temperature')}")
    print(f"Think:   {meta.get('think')}")
    print(f"Tokens:  {meta.get('num_predict')}")
    print(f"Status:  {meta.get('status')}")
    print(f"Scored:  {meta.get('scored_sections')} / {meta.get('total_sections')}")
    print(f"Output:  {args.output.resolve()}")

    if dataset["sections"]:
        example = next(
            (s for s in dataset["sections"] if "emotion_scores" in s),
            None,
        )
        if example:
            import json

            print("\n--- Example scored section ---")
            print(
                json.dumps(
                    {
                        "section_id": example["section_id"],
                        "emotion_scores": example["emotion_scores"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )

    return 0


if __name__ == "__main__":
    sys.exit(main())
