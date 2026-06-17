/**
 * Shared corpus loaders + aggregations for the lyric-analysis pages
 * (lyrical complexity, song structure).
 *
 * All computation happens at runtime in the browser from the Corpus of
 * Taylor Swift TSVs + the parsed lyric sections JSON. No build step.
 */

import * as d3 from "d3";
import { assetUrl } from "../config/constants.js";
import { ALBUM_BY_CODE, ALBUM_META, ALBUM_ORDER } from "../config/album-meta.js";

const WORD_DETAILS_URL = assetUrl("data/cots-word-details.tsv");
const SONG_DETAILS_URL = assetUrl("data/cots-song-details.tsv");
const SECTIONS_URL = assetUrl("data/parsed_lyrics_sections.json");

/** CEFR proficiency level -> numeric score (A1 = elementary ... C1 = advanced). */
export const CEFR_SCALE = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

const TOKEN_RE = /[a-z']+/g;

/** Split lyric text into lowercased word tokens. */
export function tokenize(text) {
  const out = [];
  if (!text) return out;
  const matches = String(text).toLowerCase().match(TOKEN_RE);
  if (!matches) return out;
  for (const raw of matches) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w) out.push(w);
  }
  return out;
}

/** Primary part-of-speech (first tag in the "PoSes" field). */
function primaryPos(poses) {
  if (!poses) return "";
  return poses.split(",")[0].trim();
}

let _wordMapPromise = null;
let _sectionsPromise = null;
let _songDetailsPromise = null;

/** word -> { oecRank:Number|null, cefr:String, pos:String, count:Number } */
export function loadWordMap() {
  if (!_wordMapPromise) {
    _wordMapPromise = d3.tsv(WORD_DETAILS_URL).then((rows) => {
      const map = new Map();
      for (const r of rows) {
        const word = (r.Word || "").toLowerCase();
        if (!word) continue;
        const rank = Number.parseInt(r.OECRank, 10);
        map.set(word, {
          oecRank: Number.isFinite(rank) ? rank : null,
          cefr: (r.CEFRLevel || "").trim(),
          pos: primaryPos(r.PoSes),
          count: Number.parseInt(r.Count, 10) || 0,
        });
      }
      return map;
    });
  }
  return _wordMapPromise;
}

export function loadSections() {
  if (!_sectionsPromise) {
    _sectionsPromise = d3.json(SECTIONS_URL).then((d) => d.sections || []);
  }
  return _sectionsPromise;
}

/** Map of song_id -> song-details row (title, FromTheVault, prevalent words...). */
export function loadSongDetails() {
  if (!_songDetailsPromise) {
    _songDetailsPromise = d3.tsv(SONG_DETAILS_URL).then((rows) => {
      const map = new Map();
      for (const r of rows) {
        const track = String(Number.parseInt(r.Track, 10)).padStart(2, "0");
        const id = `${r.Album}:${track}`;
        map.set(id, r);
      }
      return map;
    });
  }
  return _songDetailsPromise;
}

/** Group section records by song_id, preserving section order. */
function groupSectionsBySong(sections) {
  const bySong = new Map();
  for (const s of sections) {
    if (!ALBUM_BY_CODE.has(s.album_code)) continue; // drop "Other Songs"
    if (!bySong.has(s.song_id)) bySong.set(s.song_id, []);
    bySong.get(s.song_id).push(s);
  }
  for (const arr of bySong.values()) {
    arr.sort((a, b) => a.section_index_in_song - b.section_index_in_song);
  }
  return bySong;
}

/* ------------------------------------------------------------------ *
 *  Q7 — Lyrical complexity (CEFR vocabulary level + OEC rarity)
 * ------------------------------------------------------------------ */

/**
 * Per-song and per-album vocabulary complexity.
 *
 * @returns {Promise<{songs:Array, albums:Array}>}
 *   song: { songId, code, title, track, fromVault, cefrAvg, oecAvg,
 *           taggedTokens, totalTokens }
 *   album: { code, title, short, year, style, color, songCount, avgCefr,
 *            cefrDist:{A1..C1 fractions} }
 */
export async function loadComplexity() {
  const [wordMap, sections, songDetails] = await Promise.all([
    loadWordMap(),
    loadSections(),
    loadSongDetails(),
  ]);
  const bySong = groupSectionsBySong(sections);

  const songs = [];
  const albumAgg = new Map(); // code -> { cefrCounts, taggedTokens, songCount }

  for (const [songId, secs] of bySong) {
    const code = secs[0].album_code;
    let cefrSum = 0;
    let taggedTokens = 0;
    let oecSum = 0;
    let rankedTokens = 0;
    let totalTokens = 0;

    let albumEntry = albumAgg.get(code);
    if (!albumEntry) {
      albumEntry = {
        cefrCounts: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 },
        cefrSum: 0,
        taggedTokens: 0,
        songCount: 0,
      };
      albumAgg.set(code, albumEntry);
    }

    for (const sec of secs) {
      for (const tok of tokenize(sec.text)) {
        totalTokens += 1;
        const info = wordMap.get(tok);
        if (!info) continue;
        if (info.cefr && CEFR_SCALE[info.cefr]) {
          const score = CEFR_SCALE[info.cefr];
          cefrSum += score;
          taggedTokens += 1;
          albumEntry.cefrCounts[info.cefr] += 1;
          albumEntry.cefrSum += score;
          albumEntry.taggedTokens += 1;
        }
        if (info.oecRank != null) {
          oecSum += info.oecRank;
          rankedTokens += 1;
        }
      }
    }

    albumEntry.songCount += 1;

    const detail = songDetails.get(songId);
    songs.push({
      songId,
      code,
      title: detail?.Title || secs[0].song_id,
      track: Number.parseInt(songId.split(":")[1], 10),
      fromVault: detail?.FromTheVault === "Yes",
      cefrAvg: taggedTokens ? cefrSum / taggedTokens : null,
      oecAvg: rankedTokens ? oecSum / rankedTokens : null,
      taggedTokens,
      totalTokens,
    });
  }

  const albums = ALBUM_META.filter((m) => albumAgg.has(m.code)).map((m) => {
    const agg = albumAgg.get(m.code);
    const dist = {};
    for (const lvl of CEFR_LEVELS) {
      dist[lvl] = agg.taggedTokens ? agg.cefrCounts[lvl] / agg.taggedTokens : 0;
    }
    return {
      ...m,
      songCount: agg.songCount,
      avgCefr: agg.taggedTokens ? agg.cefrSum / agg.taggedTokens : 0,
      cefrDist: dist,
    };
  });

  songs.sort((a, b) => {
    const ai = ALBUM_ORDER.indexOf(a.code);
    const bi = ALBUM_ORDER.indexOf(b.code);
    return ai - bi || a.track - b.track;
  });

  return { songs, albums };
}

/* ------------------------------------------------------------------ *
 *  Q8 — Song structure ("DNA strip")
 * ------------------------------------------------------------------ */

/** Human-readable section bucket used by the DNA strip + legend. */
export function sectionBucket(sectionType) {
  switch (sectionType) {
    case "V":
      return "Verse";
    case "C":
      return "Chorus";
    case "B":
      return "Bridge";
    case "P":
      return "Pre-Chorus";
    case "R":
      return "Refrain";
    case "I":
    case "O":
      return "Intro / Outro";
    default:
      return "Other";
  }
}

/**
 * One row per song: ordered section segments with line counts.
 *
 * @returns {Promise<Array>} song: { songId, code, title, style, color,
 *   fromVault, totalLines, segments:[{ bucket, type, lines }] }
 */
export async function loadSongStructures() {
  const [sections, songDetails] = await Promise.all([
    loadSections(),
    loadSongDetails(),
  ]);
  const bySong = groupSectionsBySong(sections);

  const out = [];
  for (const [songId, secs] of bySong) {
    const code = secs[0].album_code;
    const meta = ALBUM_BY_CODE.get(code);
    const detail = songDetails.get(songId);
    let totalLines = 0;
    const segments = secs.map((s) => {
      const lines = s.total_lines || (s.lines ? s.lines.length : 0);
      totalLines += lines;
      return { bucket: sectionBucket(s.section_type), type: s.section_type, lines };
    });
    out.push({
      songId,
      code,
      title: detail?.Title || songId,
      style: meta.style,
      color: meta.color,
      fromVault: detail?.FromTheVault === "Yes",
      totalLines,
      segments,
    });
  }

  out.sort((a, b) => {
    const ai = ALBUM_ORDER.indexOf(a.code);
    const bi = ALBUM_ORDER.indexOf(b.code);
    return ai - bi || a.songId.localeCompare(b.songId, undefined, { numeric: true });
  });
  return out;
}
