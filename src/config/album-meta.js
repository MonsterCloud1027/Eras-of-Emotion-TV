/**
 * Canonical album metadata for the lyric-analysis visualizations
 * (lyrical complexity, song structure).
 *
 * `style` is the musical era used to group/colour albums for Q8.
 * `year` is the original release year (matches the discography timeline).
 */

export const ALBUM_META = [
  { code: "TSW", title: "Taylor Swift",                  short: "Taylor Swift",   year: 2006, style: "Country",     color: "#c9a86c" },
  { code: "FER", title: "Fearless",                      short: "Fearless",       year: 2008, style: "Country",     color: "#e8b4b8" },
  { code: "SPN", title: "Speak Now",                     short: "Speak Now",      year: 2010, style: "Country",     color: "#9b8ec4" },
  { code: "RED", title: "Red",                           short: "Red",            year: 2012, style: "Country/Pop", color: "#c45c5c" },
  { code: "NEN", title: "1989",                          short: "1989",           year: 2014, style: "Pop",         color: "#7eb8da" },
  { code: "REP", title: "Reputation",                    short: "Reputation",     year: 2017, style: "Pop",         color: "#6a6a78" },
  { code: "LVR", title: "Lover",                         short: "Lover",          year: 2019, style: "Pop",         color: "#f4a6c8" },
  { code: "FOL", title: "Folklore",                      short: "Folklore",       year: 2020, style: "Indie-Folk",  color: "#8fa68e" },
  { code: "EVE", title: "Evermore",                      short: "Evermore",       year: 2020, style: "Indie-Folk",  color: "#b8956a" },
  { code: "MID", title: "Midnights",                     short: "Midnights",      year: 2022, style: "Pop",         color: "#4a3f6b" },
  { code: "TPD", title: "The Tortured Poets Department", short: "Tortured Poets", year: 2024, style: "Pop",         color: "#a89888" },
  { code: "LSG", title: "The Life Of A Showgirl",        short: "Life Of A Showgirl", year: 2025, style: "Pop",     color: "#d4af37" },
];

/** Albums in release order (excludes the "Other Songs" bucket). */
export const ALBUM_ORDER = ALBUM_META.map((a) => a.code);

export const ALBUM_BY_CODE = new Map(ALBUM_META.map((a) => [a.code, a]));

/** Musical styles in chronological order of first appearance. */
export const STYLE_ORDER = ["Country", "Country/Pop", "Pop", "Indie-Folk"];

export const STYLE_COLORS = {
  Country: "#d99a4e",
  "Country/Pop": "#d4536a",
  Pop: "#4a7fd4",
  "Indie-Folk": "#3db892",
};
