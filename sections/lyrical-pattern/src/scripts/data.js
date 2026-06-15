"use strict";

import * as d3 from "d3";

export const albums = [
  { code: "TSW", name: "Taylor Swift",       era: "Country",     year: 2006, vocab_richness: 16.3, cefr_advanced_pct: 11.2, avg_word_length: 5.20, avg_reps: 0.8 },
  { code: "FER", name: "Fearless",           era: "Country",     year: 2008, vocab_richness: 12.1, cefr_advanced_pct: 16.0, avg_word_length: 5.48, avg_reps: 0.7 },
  { code: "SPN", name: "Speak Now",          era: "Country",     year: 2010, vocab_richness: 14.1, cefr_advanced_pct: 20.1, avg_word_length: 5.68, avg_reps: 0.6 },
  { code: "RED", name: "Red",                era: "Country/Pop", year: 2012, vocab_richness: 11.9, cefr_advanced_pct: 20.7, avg_word_length: 5.72, avg_reps: 0.6 },
  { code: "NEN", name: "1989",               era: "Pop",         year: 2014, vocab_richness: 11.3, cefr_advanced_pct: 19.5, avg_word_length: 5.45, avg_reps: 0.7 },
  { code: "REP", name: "Reputation",         era: "Pop",         year: 2017, vocab_richness: 36.5, cefr_advanced_pct: 27.3, avg_word_length: 5.93, avg_reps: 0.4 },
  { code: "FOL", name: "Folklore",           era: "Indie-Folk",  year: 2020, vocab_richness: 61.6, cefr_advanced_pct: 34.3, avg_word_length: 6.14, avg_reps: 0.1 },
  { code: "EVE", name: "Evermore",           era: "Indie-Folk",  year: 2020, vocab_richness: 53.3, cefr_advanced_pct: 38.3, avg_word_length: 6.24, avg_reps: 0.1 },
  { code: "MID", name: "Midnights",          era: "Pop",         year: 2022, vocab_richness: 48.6, cefr_advanced_pct: 38.4, avg_word_length: 6.52, avg_reps: 0.1 },
  { code: "TPD", name: "TTPD",               era: "Pop",         year: 2024, vocab_richness: 59.7, cefr_advanced_pct: 44.3, avg_word_length: 6.54, avg_reps: 0.1 },
];


export const heatMetrics = [
  { key: "vocab_richness",     label: "Vocabulary Richness" },
  { key: "cefr_advanced_pct",  label: "CEFR Advanced Vocab" },
  { key: "avg_word_length",    label: "Avg Word Length" },
  { key: "avg_reps",           label: "Repetition Rate (inv)" },
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
