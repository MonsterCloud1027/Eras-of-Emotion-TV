"""
Group parsed lyric lines into flat section records.
"""

from __future__ import annotations

from typing import Any

from helper.lyrics_parser import ParsedLyricLine, SECTION_TYPE_LABELS


def _make_section_object(
    lines: list[ParsedLyricLine],
    section_index_in_song: int,
) -> dict[str, Any]:
    """Build one section record from consecutive parsed lines."""
    first = lines[0]
    last = lines[-1]
    lyric_lines = [line.lyric for line in lines]
    text = "\n".join(lyric_lines)

    return {
        "album_code": first.album_code,
        "song_id": first.song_id,
        "section_id": f"{first.song_id}:{first.section_type}:{section_index_in_song}",
        "section_type": first.section_type,
        "section_type_label": SECTION_TYPE_LABELS.get(first.section_type, first.section_type),
        "section_index_in_song": section_index_in_song,
        "start_line": first.line_number,
        "end_line": last.line_number,
        "total_lines": len(lines),
        "lines": lyric_lines,
        "text": text,
    }


def build_sections(parsed_lines: list[ParsedLyricLine]) -> list[dict[str, Any]]:
    """
    Group consecutive lines into sections.

    A new section starts when section_type changes or the song changes.
    """
    if not parsed_lines:
        return []

    sections: list[dict[str, Any]] = []
    current_group: list[ParsedLyricLine] = [parsed_lines[0]]
    section_index_by_song: dict[str, int] = {}

    def flush_group(group: list[ParsedLyricLine]) -> None:
        song_id = group[0].song_id
        section_index_by_song[song_id] = section_index_by_song.get(song_id, 0) + 1
        sections.append(
            _make_section_object(group, section_index_by_song[song_id])
        )

    for line in parsed_lines[1:]:
        prev = current_group[-1]
        if line.song_id != prev.song_id or line.section_type != prev.section_type:
            flush_group(current_group)
            current_group = [line]
        else:
            current_group.append(line)

    flush_group(current_group)
    return sections


def _format_section(
    section: dict[str, Any],
    album: dict[str, Any],
    global_section_index: int,
    global_song_index: int,
) -> dict[str, Any]:
    """Return section with stable field order for JSON and D3."""
    return {
        "album_code": section["album_code"],
        "album_title": album["album_title"],
        "song_id": section["song_id"],
        "section_id": section["section_id"],
        "section_type": section["section_type"],
        "section_type_label": section["section_type_label"],
        "section_index_in_song": section["section_index_in_song"],
        "start_line": section["start_line"],
        "end_line": section["end_line"],
        "total_lines": section["total_lines"],
        "lines": section["lines"],
        "text": section["text"],
        "global_section_index": global_section_index,
        "global_song_index": global_song_index,
    }


def enrich_sections(
    sections: list[dict[str, Any]],
    album_lookup: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Add album titles and global indices to each section."""
    album_order: list[str] = []
    albums_seen: set[str] = set()
    global_section_index = 0
    global_song_index = 0
    last_song_id: str | None = None
    enriched: list[dict[str, Any]] = []

    for section in sections:
        album_code = section["album_code"]

        if album_code not in albums_seen:
            albums_seen.add(album_code)
            album_order.append(album_code)

        if album_code not in album_lookup:
            raise KeyError(
                f"No album metadata for code {album_code!r}. "
                f"Known codes: {sorted(album_lookup)}"
            )

        album = album_lookup[album_code]
        song_id = section["song_id"]

        if song_id != last_song_id:
            global_song_index += 1
            last_song_id = song_id

        enriched.append(
            _format_section(section, album, global_section_index, global_song_index)
        )
        global_section_index += 1

    return enriched, album_order


def build_dataset(
    sections: list[dict[str, Any]],
    album_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Build flat dataset: meta + album_order + sections array."""
    enriched, album_order = enrich_sections(sections, album_lookup)

    return {
        "meta": {
            "description": "Taylor Swift lyric sections for Eras-of-Emotion visualization",
            "section_type_labels": SECTION_TYPE_LABELS,
            "total_albums": len(album_order),
            "total_songs": enriched[-1]["global_song_index"] if enriched else 0,
            "total_sections": len(enriched),
            "total_lines": sum(s["total_lines"] for s in enriched),
        },
        "album_order": album_order,
        "sections": enriched,
    }
