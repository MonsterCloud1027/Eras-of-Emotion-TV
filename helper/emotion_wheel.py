"""
Plutchik emotion-wheel: config, section→song aggregation, polar coordinates for D3.
"""

from __future__ import annotations

import csv
import json
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal

from helper.emotion_scorer import EMOTION_KEYS

# Clockwise from top: joy → trust → … → anticipation → joy
PLUTCHIK_ORDER: tuple[str, ...] = EMOTION_KEYS

JOY_ANGLE_DEG = -90.0
ANGLE_STEP_DEG = 360.0 / len(PLUTCHIK_ORDER)
MAX_OFFSET_DEGREES = ANGLE_STEP_DEG * 0.75  # 3/4 of one sector (33.75°)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

DEFAULT_TEST_JSON = DATA_DIR / "Test.json"
DEFAULT_LLM_SCORED_JSON = DATA_DIR / "parsed_lyrics_sections_scored.json"

SONG_WHEEL_TEST_JSON = DATA_DIR / "song_emotion_wheel_data.test.json"
SONG_WHEEL_LLM_JSON = DATA_DIR / "song_emotion_wheel_data.llm.json"
SECTION_WHEEL_TEST_JSON = DATA_DIR / "section_emotion_wheel_data.test.json"
SECTION_WHEEL_LLM_JSON = DATA_DIR / "section_emotion_wheel_data.llm.json"

# Default frontend path (LLM); test scores stay in *.test.json
DEFAULT_OUTPUT_JSON = SONG_WHEEL_LLM_JSON

DEFAULT_SONG_DETAILS_TSV = (
    Path(__file__).resolve().parent.parent
    / "Corpus-of-Taylor-Swift-main"
    / "tsv"
    / "cots-song-details.tsv"
)


def _round_to(value: float, decimals: int) -> float:
    return round(value, decimals)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _left_neighbor(emotion: str) -> str:
    i = PLUTCHIK_ORDER.index(emotion)
    return PLUTCHIK_ORDER[(i - 1) % len(PLUTCHIK_ORDER)]


def _right_neighbor(emotion: str) -> str:
    i = PLUTCHIK_ORDER.index(emotion)
    return PLUTCHIK_ORDER[(i + 1) % len(PLUTCHIK_ORDER)]


def build_plutchik_config() -> dict[str, dict[str, Any]]:
    """emotion name → angle (deg), left/right neighbors on the wheel."""
    config: dict[str, dict[str, Any]] = {}
    for index, name in enumerate(PLUTCHIK_ORDER):
        config[name] = {
            "name": name,
            "angle": JOY_ANGLE_DEG + index * ANGLE_STEP_DEG,
            "left_neighbor": _left_neighbor(name),
            "right_neighbor": _right_neighbor(name),
        }
    return config


PLUTCHIK_CONFIG = build_plutchik_config()


def load_song_title_lookup(tsv_path: Path = DEFAULT_SONG_DETAILS_TSV) -> dict[str, str]:
    """Map song_id (e.g. TSW:01) → song title from CoTS TSV."""
    lookup: dict[str, str] = {}
    with tsv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        next(reader, None)
        for row in reader:
            if len(row) < 3:
                continue
            album = row[0].strip('"')
            track = int(row[1].strip('"'))
            title = row[2].strip('"')
            song_id = f"{album}:{track:02d}"
            lookup[song_id] = title
    return lookup


def parse_song_id(song_id: str) -> tuple[str, int]:
    album_code, track_str = song_id.split(":", 1)
    return album_code, int(track_str)


def song_sort_key(song: dict[str, Any], album_order: list[str]) -> tuple[int, int]:
    """Sort by album_order, then track number within album."""
    album_code = song.get("album_code") or parse_song_id(song["song_id"])[0]
    track = parse_song_id(song["song_id"])[1]
    try:
        album_index = album_order.index(album_code)
    except ValueError:
        album_index = len(album_order)
    return album_index, track


def normalize_emotion_scores(scores: dict[str, Any]) -> dict[str, float]:
    return {
        emotion: _round_to(_clamp01(float(scores.get(emotion, 0.0))), 3)
        for emotion in PLUTCHIK_ORDER
    }


def aggregate_sections_to_songs(
    dataset: dict[str, Any],
    *,
    song_titles: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """
    Aggregate section emotion_scores to song-level line-weighted means.

    Each line in a section contributes the section's emotion_scores to the song mean.
    """
    song_titles = song_titles or load_song_title_lookup()
    sums: dict[str, dict[str, float]] = defaultdict(lambda: {k: 0.0 for k in PLUTCHIK_ORDER})
    counts: dict[str, int] = defaultdict(int)
    meta: dict[str, dict[str, str]] = {}

    for section in dataset["sections"]:
        scores = section.get("emotion_scores")
        if not scores:
            raise ValueError(
                f"Section {section.get('section_id', '?')} missing emotion_scores."
            )

        song_id = section["song_id"]
        line_count = len(section.get("lines") or [])
        if line_count == 0:
            continue

        if song_id not in meta:
            meta[song_id] = {
                "song_id": song_id,
                "song_title": song_titles.get(song_id, song_id),
                "album": section["album_title"],
                "album_code": section["album_code"],
            }

        for emotion in PLUTCHIK_ORDER:
            value = _clamp01(float(scores.get(emotion, 0.0)))
            sums[song_id][emotion] += value * line_count
        counts[song_id] += line_count

    songs: list[dict[str, Any]] = []
    for song_id, total_lines in counts.items():
        means = {
            emotion: _round_to(_clamp01(sums[song_id][emotion] / total_lines), 3)
            for emotion in PLUTCHIK_ORDER
        }
        songs.append(
            {
                **meta[song_id],
                "n_lyrics": total_lines,
                "emotion_scores_mean": means,
            }
        )

    album_order = dataset.get("album_order") or []
    songs.sort(key=lambda s: song_sort_key(s, album_order))
    return songs


def aggregate_sections_from_test_json(
    dataset: dict[str, Any],
    *,
    song_titles: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Alias for aggregate_sections_to_songs (historical name)."""
    return aggregate_sections_to_songs(dataset, song_titles=song_titles)


def get_primary_emotion(
    scores: dict[str, float],
    *,
    tie_break: Literal["wheel", "random"] = "wheel",
    rng: random.Random | None = None,
) -> str:
    """
    Highest score wins.

    tie_break="wheel": ties → first in PLUTCHIK_ORDER (joy-first, clockwise).
    tie_break="random": ties → uniform random among tied emotions.
    """
    max_score = max(scores[emotion] for emotion in PLUTCHIK_ORDER)
    tied = [emotion for emotion in PLUTCHIK_ORDER if scores[emotion] == max_score]
    if len(tied) == 1:
        return tied[0]
    if tie_break == "random":
        return (rng or random).choice(tied)
    return tied[0]


def get_neighbor_emotions(emotion: str) -> dict[str, str]:
    cfg = PLUTCHIK_CONFIG[emotion]
    return {
        "left_neighbor": cfg["left_neighbor"],
        "right_neighbor": cfg["right_neighbor"],
    }


def compute_wheel_coordinates_from_scores(
    scores: dict[str, float],
    *,
    tie_break: Literal["wheel", "random"] = "wheel",
    rng: random.Random | None = None,
) -> dict[str, Any]:
    """
    Map one Plutchik score vector to wheel (angle, radius, x, y).
    Angle = primary axis + neighbor_balance * MAX_OFFSET (3/4 sector); radius = primary score.
    """
    primary = get_primary_emotion(scores, tie_break=tie_break, rng=rng)
    neighbors = get_neighbor_emotions(primary)
    cfg = PLUTCHIK_CONFIG[primary]

    primary_score = scores[primary]
    left_score = scores[neighbors["left_neighbor"]]
    right_score = scores[neighbors["right_neighbor"]]

    neighbor_balance = right_score - left_score
    angle_offset = neighbor_balance * MAX_OFFSET_DEGREES
    angle = cfg["angle"] + angle_offset
    radius = primary_score

    rad = math.radians(angle)
    x = radius * math.cos(rad)
    y = radius * math.sin(rad)

    return {
        "primary_emotion": primary,
        "primary_score": _round_to(primary_score, 3),
        "left_neighbor": neighbors["left_neighbor"],
        "right_neighbor": neighbors["right_neighbor"],
        "base_angle": _round_to(cfg["angle"], 1),
        "angle_offset": _round_to(angle_offset, 1),
        "angle": _round_to(angle, 1),
        "radius": _round_to(radius, 3),
        "x": _round_to(x, 3),
        "y": _round_to(y, 3),
    }


def compute_emotion_wheel_coordinates(song: dict[str, Any]) -> dict[str, Any]:
    """Song-level wrapper (uses emotion_scores_mean)."""
    return compute_wheel_coordinates_from_scores(song["emotion_scores_mean"])


def enrich_songs_with_wheel_coordinates(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{**song, **compute_emotion_wheel_coordinates(song)} for song in songs]


def enrich_sections_with_wheel_coordinates(
    dataset: dict[str, Any],
) -> list[dict[str, Any]]:
    """Per-section wheel coords from section emotion_scores (same angle logic as songs)."""
    sections: list[dict[str, Any]] = []

    for section in dataset.get("sections", []):
        line_count = len(section.get("lines") or [])
        if line_count == 0:
            continue

        raw_scores = section.get("emotion_scores")
        if not raw_scores:
            raise ValueError(
                f"Section {section.get('section_id', '?')} missing emotion_scores."
            )

        scores = normalize_emotion_scores(raw_scores)
        section_id = section["section_id"]
        sections.append(
            {
                "section_id": section_id,
                "song_id": section["song_id"],
                "album_code": section.get("album_code"),
                "album_title": section.get("album_title"),
                "section_type": section.get("section_type"),
                "section_type_label": section.get("section_type_label"),
                "section_index_in_song": section.get("section_index_in_song"),
                "global_section_index": section.get("global_section_index"),
                "n_lyrics": line_count,
                "emotion_scores": scores,
                **compute_wheel_coordinates_from_scores(
                    scores,
                    tie_break="random",
                    rng=random.Random(section_id),
                ),
            }
        )

    return sections


def build_song_and_section_wheel(
    dataset: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    songs = enrich_songs_with_wheel_coordinates(aggregate_sections_to_songs(dataset))
    sections = enrich_sections_with_wheel_coordinates(dataset)
    return songs, sections


def export_json(data: list[dict[str, Any]], output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return output_path


def build_song_emotion_wheel_from_test_json(
    source_path: Path = DEFAULT_TEST_JSON,
    output_path: Path = DEFAULT_OUTPUT_JSON,
) -> list[dict[str, Any]]:
    with source_path.open(encoding="utf-8") as handle:
        dataset = json.load(handle)

    songs, _ = build_song_and_section_wheel(dataset)
    return songs
