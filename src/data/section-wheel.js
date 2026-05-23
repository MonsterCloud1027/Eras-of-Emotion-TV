import * as d3 from "d3";
import { SECTION_DATA_URL } from "../config/constants.js";

/**
 * @returns {Map<string, object[]>} song_id → wheel sections (x, y, primary, …)
 */
export async function loadSectionWheelBySong() {
  const data = await d3.json(SECTION_DATA_URL);
  if (!Array.isArray(data)) {
    throw new Error("Expected section_emotion_wheel_data.llm.json to be an array");
  }

  const bySong = new Map();
  for (const section of data) {
    const songId = section.song_id;
    if (!bySong.has(songId)) bySong.set(songId, []);
    bySong.get(songId).push(section);
  }

  for (const sections of bySong.values()) {
    sections.sort(
      (a, b) =>
        (a.section_index_in_song ?? 0) - (b.section_index_in_song ?? 0)
    );
  }

  return bySong;
}

/** Attach lyric text from parsed sections. */
export function mergeSectionLyrics(wheelSections, lyricsSections) {
  const byId = new Map(
    (lyricsSections ?? []).map((s) => [s.section_id, s])
  );
  return wheelSections.map((sec) => {
    const rich = byId.get(sec.section_id);
    return rich
      ? {
          ...sec,
          text: rich.text,
          lines: rich.lines,
          total_lines: rich.total_lines,
        }
      : { ...sec };
  });
}

export function getSongSectionsForDrilldown(song, sectionsBySong, sectionWheelBySong) {
  const wheel = sectionWheelBySong?.get(song.song_id) ?? [];
  const lyrics = sectionsBySong?.get(song.song_id) ?? [];
  return mergeSectionLyrics(wheel, lyrics);
}
