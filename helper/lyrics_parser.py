"""
Parse raw lyric lines from TXT or TSV corpus files.

Expected line format:
    ALBUM_CODE:SONG_NUMBER:LINE_NUMBER:SECTION_TYPE<delimiter>lyric text

Delimiter may be tab (TSV) or a single space (TXT).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

# Album code (3 letters) : song (2 digits) : line (3 digits) : section (1 letter)
LINE_ID_PATTERN = re.compile(
    r"^([A-Z]{3}):(\d{2}):(\d{3}):([A-Z])(?:\t| )(.*)$"
)

VALID_SECTION_TYPES = frozenset({"V", "C", "B", "P", "O", "I", "R"})

SECTION_TYPE_LABELS: dict[str, str] = {
    "V": "Verse",
    "C": "Chorus",
    "B": "Bridge",
    "P": "Pre-Chorus",
    "O": "Outro",
    "I": "Intro",
    "R": "Refrain",
}


class LyricParseError(ValueError):
    """Raised when a lyric line cannot be parsed."""


@dataclass(frozen=True)
class ParsedLyricLine:
    """Single parsed lyric line with metadata."""

    album_code: str
    song_number: str
    line_number: str
    section_type: str
    lyric: str
    line_id: str
    source_line_number: int

    @property
    def song_id(self) -> str:
        return f"{self.album_code}:{self.song_number}"


def parse_lyric_line(raw_line: str, source_line_number: int) -> ParsedLyricLine:
    """
    Parse one raw line into structured fields.

    Preserves lyric text exactly as stored after the ID delimiter.
    """
    stripped = raw_line.rstrip("\n\r")
    if not stripped or stripped.isspace():
        raise LyricParseError(f"Line {source_line_number}: empty line")

    match = LINE_ID_PATTERN.match(stripped)
    if not match:
        raise LyricParseError(
            f"Line {source_line_number}: invalid format — "
            f"expected ALBUM:SONG:LINE:TYPE followed by lyric text. "
            f"Got: {stripped[:80]!r}{'...' if len(stripped) > 80 else ''}"
        )

    album_code, song_number, line_number, section_type, lyric = match.groups()

    if section_type not in VALID_SECTION_TYPES:
        raise LyricParseError(
            f"Line {source_line_number}: unknown section type {section_type!r}. "
            f"Valid types: {sorted(VALID_SECTION_TYPES)}"
        )

    line_id = f"{album_code}:{song_number}:{line_number}:{section_type}"

    return ParsedLyricLine(
        album_code=album_code,
        song_number=song_number,
        line_number=line_number,
        section_type=section_type,
        lyric=lyric,
        line_id=line_id,
        source_line_number=source_line_number,
    )


def read_lyric_file(path: Path) -> Iterator[ParsedLyricLine]:
    """
    Read and parse all lyric lines from a file.

    Skips blank lines. Raises LyricParseError on the first malformed line.
    """
    if not path.exists():
        raise FileNotFoundError(f"Lyric file not found: {path}")

    with path.open(encoding="utf-8", newline="") as handle:
        for line_no, raw in enumerate(handle, start=1):
            if not raw.strip():
                continue
            yield parse_lyric_line(raw, line_no)
