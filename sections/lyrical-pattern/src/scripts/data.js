"use strict";

import * as d3 from "d3";

import { assetUrl } from "../../../../src/config/constants.js";

const WORD_DETAILS_URL = assetUrl("data/cots-word-details.tsv");
const SECTION_DATA_URL = assetUrl("data/parsed_lyrics_sections_scored.json");
const TOKEN_RE = /[a-z']+/g;
const ALBUM_META = [
  { code: "TSW", short: "Taylor Swift", style: "Country", year: 2006 },
  { code: "FER", short: "Fearless", style: "Country", year: 2008 },
  { code: "SPN", short: "Speak Now", style: "Country", year: 2010 },
  { code: "RED", short: "Red", style: "Country/Pop", year: 2012 },
  { code: "NEN", short: "1989", style: "Pop", year: 2014 },
  { code: "REP", short: "Reputation", style: "Pop", year: 2017 },
  { code: "LVR", short: "Lover", style: "Pop", year: 2019 },
  { code: "FOL", short: "Folklore", style: "Indie-Folk", year: 2020 },
  { code: "EVE", short: "Evermore", style: "Indie-Folk", year: 2020 },
  { code: "MID", short: "Midnights", style: "Pop", year: 2022 },
  { code: "TPD", short: "Tortured Poets", style: "Pop", year: 2024 },
  { code: "LSG", short: "Life Of A Showgirl", style: "Pop", year: 2025 },
];
const ALBUM_ORDER = ALBUM_META.map((album) => album.code);


function tokenize(text) {
  const matches = String(text || "").toLowerCase().match(TOKEN_RE);
  if (!matches) return [];
  return matches.map((token) => token.replace(/^'+|'+$/g, "")).filter(Boolean);
}


function primaryPos(poses) {
  if (!poses) return "";
  return String(poses).split(",")[0].trim();
}


function createAlbumRecord(meta, title) {
  return {
    code: meta.code,
    name: title || meta.short,
    era: meta.style,
    year: meta.year,
    totalTokens: 0,
    uniqueTokens: new Set(),
    wordLengthSum: 0,
    advancedTokens: 0,
    nounTokens: 0,
    verbTokens: 0,
    adjectiveTokens: 0,
    repeatedTokens: 0,
  };
}


function finaliseAlbumRecord(record) {
  const total = record.totalTokens || 1;
  return {
    code: record.code,
    name: record.name,
    era: record.era,
    year: record.year,
    vocab_richness: (record.uniqueTokens.size / total) * 100,
    cefr_advanced_pct: (record.advancedTokens / total) * 100,
    avg_word_length: record.wordLengthSum / total,
    avg_reps: (record.repeatedTokens / total) * 100,
    noun_density: (record.nounTokens / total) * 100,
    verb_density: (record.verbTokens / total) * 100,
    adjective_density: (record.adjectiveTokens / total) * 100,
  };
}


async function loadWordMap() {
  const rows = await d3.tsv(WORD_DETAILS_URL);
  const map = new Map();

  for (const row of rows) {
    const word = String(row.Word || "").toLowerCase().trim();
    if (!word) continue;

    map.set(word, {
      cefr: String(row.CEFRLevel || "").trim(),
      pos: primaryPos(row.PoSes),
      length: Number.parseInt(row.Length, 10) || word.length,
    });
  }

  return map;
}


async function loadSections() {
  const data = await d3.json(SECTION_DATA_URL);
  return data?.sections || [];
}


function aggregateHeatmapData(sections, wordMap) {
  const byAlbum = new Map();

  for (const section of sections) {
    if (!ALBUM_ORDER.includes(section.album_code)) continue;

    const meta = ALBUM_META.find((album) => album.code === section.album_code);
    if (!meta) continue;

    let record = byAlbum.get(section.album_code);
    if (!record) {
      record = createAlbumRecord(meta, section.album_title);
      byAlbum.set(section.album_code, record);
    }

    const tokens = tokenize(section.text);
    let previousToken = null;

    for (const token of tokens) {
      const info = wordMap.get(token);

      record.totalTokens += 1;
      record.uniqueTokens.add(token);
      record.wordLengthSum += info?.length ?? token.length;

      if (info?.cefr === "B2" || info?.cefr === "C1") {
        record.advancedTokens += 1;
      }
      if (info?.pos === "Noun") record.nounTokens += 1;
      if (info?.pos === "Verb") record.verbTokens += 1;
      if (info?.pos === "Adje") record.adjectiveTokens += 1;
      if (previousToken === token) record.repeatedTokens += 1;

      previousToken = token;
    }
  }

  return ALBUM_ORDER
    .filter((code) => byAlbum.has(code))
    .map((code) => finaliseAlbumRecord(byAlbum.get(code)));
}


let heatmapDataPromise = null;


export function loadHeatmapData() {
  if (!heatmapDataPromise) {
    heatmapDataPromise = Promise.all([loadWordMap(), loadSections()])
      .then(([wordMap, sections]) => aggregateHeatmapData(sections, wordMap));
  }

  return heatmapDataPromise;
}


export const heatMetrics = [
  { key: "vocab_richness", label: "Vocabulary Richness", percent: true },
  { key: "cefr_advanced_pct", label: "CEFR Advanced Vocab", percent: true },
  { key: "avg_word_length", label: "Average Word Length", percent: false },
  { key: "avg_reps", label: "Repetition Rate", percent: true, invert: true },
  { key: "noun_density", label: "Noun Density", percent: true },
  { key: "verb_density", label: "Verb Density", percent: true },
  { key: "adjective_density", label: "Adjective Density", percent: true },
];


export const eraHueScale = {
  "Country":     d3.interpolateOranges,
  "Country/Pop": d3.interpolateReds,
  "Pop":         d3.interpolateBlues,
  "Indie-Folk":  d3.interpolateGreens,
};


export const eraSolidColor = {
  "Country":     eraHueScale["Country"](0.7),
  "Country/Pop": eraHueScale["Country/Pop"](0.7),
  "Pop":         eraHueScale["Pop"](0.7),
  "Indie-Folk":  eraHueScale["Indie-Folk"](0.7),
};
