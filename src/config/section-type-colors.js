import * as d3 from "d3";

/** Colors by human-readable section type (matches section_type_label). */
export const SECTION_TYPE_COLORS = {
  Verse: "#4a7fd4",
  Chorus: "#d4536a",
  Bridge: "#8b5fc7",
  "Pre-Chorus": "#3db892",
  Intro: "#c9973a",
  Outro: "#7a8b98",
  Refrain: "#d78bb8",
};

export function buildSectionTypeColorScale() {
  return d3
    .scaleOrdinal()
    .domain(Object.keys(SECTION_TYPE_COLORS))
    .range(Object.values(SECTION_TYPE_COLORS))
    .unknown("#9a9088");
}

export function sectionTypeColor(scale, section) {
  const label =
    section?.section_type_label ||
    section?.section_type ||
    "Section";
  return scale(label);
}
