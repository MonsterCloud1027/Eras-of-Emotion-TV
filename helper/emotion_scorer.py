"""
Score lyric sections with local Ollama (Plutchik 8-emotion model).
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from copy import deepcopy
from pathlib import Path
from typing import Any

EMOTION_KEYS = (
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
)

DEFAULT_MODEL = "qwen3:8b"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_TEMPERATURE = 0.3
DEFAULT_THINK = True
DEFAULT_NUM_PREDICT = 2048
# Extra headroom for final JSON in ``response`` when thinking is enabled.
DEFAULT_NUM_PREDICT_WITH_THINK = 4096
MAX_ALL_ZERO_RETRIES = 5

PROMPT_TEMPLATE = """You are scoring the emotional tone of a lyric section.

Evaluate the emotional tone expressed by the lyric section, not just the literal emotion words.

Consider the 8 emotions one by one before assigning the final scores.

Score the intensity of each of the following 8 emotions:
joy, trust, fear, surprise, sadness, disgust, anger, anticipation.

Use Plutchik’s 8 basic emotions as the emotional framework. Each emotion should be understood as a core emotional dimension with different possible intensity levels.

Emotion guide:

- joy: positive pleasure, happiness, delight, or emotional warmth. In Plutchik’s wheel, lower-intensity joy is serenity, and higher-intensity joy is ecstasy.
- trust: acceptance, safety, closeness, confidence, admiration, or reliance on someone/something. In Plutchik’s wheel, lower-intensity trust is acceptance, and higher-intensity trust is admiration.
- fear: apprehension, worry, anxiety, insecurity, vulnerability, or terror. In Plutchik’s wheel, lower-intensity fear is apprehension, and higher-intensity fear is terror.
- surprise: distraction, unexpectedness, shock, sudden realization, amazement, or being emotionally disrupted by something unforeseen. In Plutchik’s wheel, lower-intensity surprise is distraction, and higher-intensity surprise is amazement.
- sadness: pensiveness, sorrow, loss, loneliness, regret, disappointment, grief, or emotional pain. In Plutchik’s wheel, lower-intensity sadness is pensiveness, and higher-intensity sadness is grief.
- disgust: boredom, rejection, aversion, contempt, emotional repulsion, strong dislike, or loathing. In Plutchik’s wheel, lower-intensity disgust is boredom, and higher-intensity disgust is loathing.
- anger: annoyance, irritation, frustration, resentment, hostility, feeling wronged, or rage. In Plutchik’s wheel, lower-intensity anger is annoyance, and higher-intensity anger is rage.
- anticipation: interest, expectation, waiting, future-oriented tension, alertness, or vigilance. In Plutchik’s wheel, lower-intensity anticipation is interest, and higher-intensity anticipation is vigilance.

Each score should be a float from 0.0 to 1.0:
- 0.0 means this emotion is not expressed in the lyric section
- 1.0 means this emotion is expressed very strongly

Use exactly one decimal place for every score.
For example: 0.0, 0.2, 0.5, 1.0.

Return ONLY valid JSON in this exact format (final answer only, no extra text):

{{
  "emotion_scores": {{
    "joy": <number>,
    "trust": <number>,
    "fear": <number>,
    "surprise": <number>,
    "sadness": <number>,
    "disgust": <number>,
    "anger": <number>,
    "anticipation": <number>
  }}
}}


Lyric section:
{text}"""


class EmotionScoreError(Exception):
    """Raised when Ollama response cannot be parsed into emotion scores."""


def build_prompt(lyric_text: str) -> str:
    return PROMPT_TEMPLATE.format(text=lyric_text.strip())


def _extract_json_blob(raw: str) -> str:
    """Pull JSON object from model output (handles markdown fences / extra text)."""
    text = raw.strip()
    if not text:
        raise EmotionScoreError("Empty model response")

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return fence.group(1)

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise EmotionScoreError(f"No JSON object found in response: {text[:200]!r}")
    return text[start : end + 1]


def normalize_emotion_scores(payload: dict[str, Any]) -> dict[str, float]:
    """Validate and clamp scores to [0, 1]."""
    if "emotion_scores" not in payload:
        raise EmotionScoreError(f"Missing emotion_scores key: {payload}")

    raw_scores = payload["emotion_scores"]
    if not isinstance(raw_scores, dict):
        raise EmotionScoreError(f"emotion_scores must be an object: {raw_scores!r}")

    normalized: dict[str, float] = {}
    for key in EMOTION_KEYS:
        if key not in raw_scores:
            raise EmotionScoreError(f"Missing emotion key {key!r}")
        value = float(raw_scores[key])
        normalized[key] = max(0.0, min(1.0, value))

    return normalized


def parse_emotion_response(response_text: str) -> dict[str, float]:
    blob = _extract_json_blob(response_text)
    try:
        payload = json.loads(blob)
    except json.JSONDecodeError as exc:
        raise EmotionScoreError(f"Invalid JSON: {exc}") from exc
    return normalize_emotion_scores(payload)


def is_all_zero_scores(scores: dict[str, float]) -> bool:
    """True when every emotion dimension is exactly 0."""
    return all(scores[key] == 0.0 for key in EMOTION_KEYS)


def call_ollama(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_OLLAMA_URL,
    temperature: float = DEFAULT_TEMPERATURE,
    think: bool = DEFAULT_THINK,
    num_predict: int = DEFAULT_NUM_PREDICT,
    timeout: int = 300,
    max_retries: int = 3,
) -> tuple[str, str]:
    """
    Call Ollama /api/generate and return (response, thinking).

    - think=True: top-level ``think: true``, no ``format: json`` (json mode hides thinking).
    - think=False: ``format: json`` for stricter structured output.
    """
    effective_predict = (
        max(num_predict, DEFAULT_NUM_PREDICT_WITH_THINK) if think else num_predict
    )
    options = {"temperature": temperature, "num_predict": effective_predict}

    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": think,
        "options": options,
    }
    if not think:
        payload["format"] = "json"

    body = json.dumps(payload).encode("utf-8")

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            request = urllib.request.Request(
                base_url,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=timeout) as handle:
                data = json.loads(handle.read().decode("utf-8"))

            response = (data.get("response") or "").strip()
            thinking = (data.get("thinking") or "").strip()

            if not response:
                raise EmotionScoreError(
                    "Empty response from Ollama. "
                    f"think={think}, thinking_chars={len(thinking)} — "
                    "try increasing --num-predict or use --no-think."
                )
            return response, thinking
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, EmotionScoreError) as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 * attempt)
            continue

    raise EmotionScoreError(f"Ollama request failed after {max_retries} tries: {last_error}")


def score_section_text(
    lyric_text: str,
    *,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_OLLAMA_URL,
    temperature: float = DEFAULT_TEMPERATURE,
    think: bool = DEFAULT_THINK,
    num_predict: int = DEFAULT_NUM_PREDICT,
    max_zero_retries: int = MAX_ALL_ZERO_RETRIES,
) -> dict[str, float]:
    """
    Score one lyric section via Ollama.

    If all 8 emotions are 0.0, re-request until a non-zero vector is returned
    or max_zero_retries is reached.
    """
    prompt = build_prompt(lyric_text)
    scores: dict[str, float] | None = None

    for attempt in range(1, max_zero_retries + 1):
        response_text, thinking_text = call_ollama(
            prompt,
            model=model,
            base_url=base_url,
            temperature=temperature,
            think=think,
            num_predict=num_predict,
        )
        if think:
            if thinking_text:
                print(f"  -> thinking {len(thinking_text)} chars (generate)", flush=True)
            else:
                print(
                    "  -> thinking enabled but trace is empty "
                    "(do not use format:json with think)",
                    flush=True,
                )
        scores = parse_emotion_response(response_text)

        if not is_all_zero_scores(scores):
            if attempt > 1:
                print(f"  -> non-zero scores on attempt {attempt}", flush=True)
            return scores

        if attempt < max_zero_retries:
            print(
                f"  -> all emotions 0.0, re-scoring ({attempt}/{max_zero_retries}) ...",
                flush=True,
            )
            time.sleep(1)

    print(
        f"  -> warning: still all 0.0 after {max_zero_retries} attempts; keeping last result",
        flush=True,
    )
    return scores if scores is not None else dict.fromkeys(EMOTION_KEYS, 0.0)


def load_source_dataset(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def init_output_dataset(source: dict[str, Any]) -> dict[str, Any]:
    """Clone source dataset; sections without emotion_scores yet."""
    dataset = deepcopy(source)
    meta = dataset.setdefault("meta", {})
    meta["emotion_scoring"] = {
        "model": DEFAULT_MODEL,
        "temperature": DEFAULT_TEMPERATURE,
        "think": DEFAULT_THINK,
        "num_predict": DEFAULT_NUM_PREDICT,
        "max_all_zero_retries": MAX_ALL_ZERO_RETRIES,
        "status": "in_progress",
        "scored_sections": 0,
        "total_sections": len(dataset.get("sections", [])),
    }
    for section in dataset.get("sections", []):
        section.pop("emotion_scores", None)
    return dataset


def reset_output_files(output_path: Path) -> None:
    """Remove scored output and temp files so scoring starts from section 0."""
    tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    for path in (output_path, tmp_path):
        if path.exists():
            path.unlink()


def load_or_init_output(
    source_path: Path,
    output_path: Path,
    *,
    reset: bool = False,
) -> dict[str, Any]:
    if reset:
        reset_output_files(output_path)
    if output_path.exists():
        with output_path.open(encoding="utf-8") as handle:
            return json.load(handle)
    source = load_source_dataset(source_path)
    return init_output_dataset(source)


def save_dataset_atomic(path: Path, dataset: dict[str, Any]) -> None:
    """
    Save JSON with a temp file when possible.

    On Windows, os.replace() fails with WinError 5 if the target file is open
    in the editor (Cursor/VS Code). Falls back to in-place overwrite.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(dataset, ensure_ascii=False, indent=2)
    tmp_path = path.with_suffix(path.suffix + ".tmp")

    tmp_path.write_text(payload, encoding="utf-8")

    try:
        tmp_path.replace(path)
        return
    except OSError:
        pass

    # Fallback: overwrite target directly (works when editor holds a read lock)
    try:
        path.write_text(payload, encoding="utf-8")
    except OSError as exc:
        raise EmotionScoreError(
            f"Cannot write {path}. Close this file in your editor (if open), "
            f"then re-run score_emotions.py to resume. "
            f"Latest data may be in {tmp_path}."
        ) from exc
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass


def section_needs_scoring(section: dict[str, Any]) -> bool:
    """Section needs scoring only when emotion_scores is absent."""
    return "emotion_scores" not in section


def find_resume_index(sections: list[dict[str, Any]]) -> int:
    """Index of first section without emotion_scores (resume skips scored)."""
    for index, section in enumerate(sections):
        if section_needs_scoring(section):
            return index
    return len(sections)


def run_scoring(
    source_path: Path,
    output_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_OLLAMA_URL,
    start_index: int = 0,
    limit: int | None = None,
    reset: bool = False,
    temperature: float = DEFAULT_TEMPERATURE,
    think: bool = DEFAULT_THINK,
    num_predict: int = DEFAULT_NUM_PREDICT,
    max_zero_retries: int = MAX_ALL_ZERO_RETRIES,
) -> dict[str, Any]:
    """
    Score sections one-by-one; save output after each successful score.

    Supports resume: skips sections that already have emotion_scores
    (all-zero vectors count as done; zero-retry only applies while scoring).
    Pass reset=True to delete output and score from the first section again.
    """
    dataset = load_or_init_output(source_path, output_path, reset=reset)
    sections = dataset["sections"]
    resume_index = max(find_resume_index(sections), start_index)
    already_scored = sum(1 for s in sections if not section_needs_scoring(s))

    end_index = len(sections)
    if limit is not None:
        end_index = min(end_index, resume_index + limit)

    total = len(sections)
    if already_scored and resume_index < total:
        print(
            f"Resume: {already_scored}/{total} sections already scored; "
            f"continuing from [{resume_index + 1}/{total}].",
            flush=True,
        )
    elif resume_index >= total:
        print(f"All {total} sections already scored.", flush=True)

    for index in range(resume_index, end_index):
        section = sections[index]
        if not section_needs_scoring(section):
            continue

        section_id = section.get("section_id", f"index:{index}")
        lyric_text = section.get("text", "")

        print(f"[{index + 1}/{total}] Scoring {section_id} ...", flush=True)
        scores = score_section_text(
            lyric_text,
            model=model,
            base_url=base_url,
            temperature=temperature,
            think=think,
            num_predict=num_predict,
            max_zero_retries=max_zero_retries,
        )
        section["emotion_scores"] = scores

        meta = dataset.setdefault("meta", {})
        scoring_meta = meta.setdefault("emotion_scoring", {})
        scoring_meta["model"] = model
        scoring_meta["temperature"] = temperature
        scoring_meta["think"] = think
        scoring_meta["num_predict"] = num_predict
        scoring_meta["max_all_zero_retries"] = max_zero_retries
        scoring_meta["scored_sections"] = sum(
            1 for s in sections if "emotion_scores" in s
        )
        scoring_meta["total_sections"] = total
        scoring_meta["status"] = (
            "complete" if scoring_meta["scored_sections"] == total else "in_progress"
        )
        scoring_meta["last_section_id"] = section_id

        save_dataset_atomic(output_path, dataset)
        print(f"  -> saved {output_path.name}", flush=True)

    if dataset["meta"]["emotion_scoring"]["scored_sections"] == total:
        dataset["meta"]["emotion_scoring"]["status"] = "complete"

    return dataset
