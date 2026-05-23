/** Shared paths & Plutchik wheel constants */

/** Resolve public/data paths for GitHub Pages subpath (import.meta.env.BASE_URL). */
export function assetUrl(path) {
  const rel = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${rel}`;
}

/** LLM-scored song wheel (default viz) */
export const DATA_URL = assetUrl("data/song_emotion_wheel_data.llm.json");
/** NRCLex test scores (preserved separately) */
export const DATA_URL_TEST = assetUrl("data/song_emotion_wheel_data.test.json");
export const SECTION_DATA_URL = assetUrl(
  "data/section_emotion_wheel_data.llm.json"
);
export const SECTION_DATA_URL_TEST = assetUrl(
  "data/section_emotion_wheel_data.test.json"
);
/** Section lyrics + scores for detail panel */
export const SECTION_LYRICS_URL = assetUrl(
  "data/parsed_lyrics_sections_scored.json"
);

/** Center image when scroll view is Global Galaxy */
export const GLOBAL_CENTER_IMAGE = assetUrl("image/era-Photoroom.png");

export const PLUTCHIK_ORDER = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
];

export const INTENSITY_RINGS = [0.25, 0.5, 0.75, 1.0];

/** Fraction of wheel radius left empty at the center (donut hole). */
export const INNER_HOLE_RATIO = 0.40;

/** Overview galaxy SVG layout (scroll stage). */
export const VIZ_MAX_SIZE = 980;
export const WHEEL_RADIUS_RATIO = 0.41;

/**
 * Scroll distance per era step, in viewport heights (1 = one screen).
 * Raise to stay on each album longer before crossfade; lower for faster switching.
 */
export const SCROLL_STEP_VH = 2.65;

export function getOverviewVizLayout(containerWidth) {
  const width = Math.min(
    VIZ_MAX_SIZE,
    containerWidth > 0 ? containerWidth : VIZ_MAX_SIZE
  );
  const wheelRadius = width * WHEEL_RADIUS_RATIO;
  return {
    width,
    height: width,
    wheelRadius,
    centerX: width / 2,
    centerY: width / 2,
  };
}

/** HTML center glass circle diameter as % of .overview-viz-frame width */
export function wheelGlassDiameterPercent() {
  return INNER_HOLE_RATIO * WHEEL_RADIUS_RATIO * 2 * 100;
}

export const ALBUM_DISPLAY_ORDER = [
  "Taylor Swift",
  "Fearless",
  "Speak Now",
  "Red",
  "1989",
  "Reputation",
  "Lover",
  "Folklore",
  "Evermore",
  "Midnights",
  "The Tortured Poets Department",
  "The Life Of A Showgirl",
  "Other Songs",
];

export const ALBUM_COLOR_PALETTE = [
  "#c9a86c",
  "#e8b4b8",
  "#9b8ec4",
  "#c45c5c",
  "#7eb8da",
  "#2d2d2d",
  "#f4a6c8",
  "#8fa68e",
  "#b8956a",
  "#4a3f6b",
  "#a89888",
  "#d4af37",
  "#9a9a9a",
];

export const JOY_ANGLE_DEG = -90;
export const ANGLE_STEP_DEG = 45;
