import * as d3 from "d3";
import { SECTION_LYRICS_URL } from "../config/constants.js";

/**
 * Sections with lyric text + emotion_scores (from parsed_lyrics_sections_scored.json).
 * @returns {Map<string, object[]>} song_id → sections
 */
export async function loadSectionsBySong() {
  const data = await d3.json(SECTION_LYRICS_URL);
  const sections = data?.sections;
  if (!Array.isArray(sections)) {
    throw new Error("Expected parsed_lyrics_sections_scored.json with sections array");
  }

  const bySong = new Map();
  for (const section of sections) {
    const songId = section.song_id;
    if (!bySong.has(songId)) bySong.set(songId, []);
    bySong.get(songId).push(section);
  }
  return bySong;
}

/**
 * Section where the song's primary emotion scores highest (ties → earlier in song).
 */
export function findPeakPrimarySection(song, sectionsBySong) {
  const primary = song?.primary_emotion;
  const songId = song?.song_id;
  if (!primary || !songId) return null;

  const sections = sectionsBySong?.get(songId);
  if (!sections?.length) return null;

  let best = null;
  let bestScore = -1;

  for (const section of sections) {
    const score = Number(section.emotion_scores?.[primary] ?? 0);
    const index = section.section_index_in_song ?? 0;
    if (
      score > bestScore ||
      (score === bestScore &&
        best &&
        index < (best.section_index_in_song ?? 0))
    ) {
      bestScore = score;
      best = section;
    }
  }

  return best;
}
