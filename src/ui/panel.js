import * as d3 from "d3";
import { PLUTCHIK_ORDER } from "../config/constants.js";
import { sectionTypeColor } from "../config/section-type-colors.js";
import { findPeakPrimarySection } from "../data/sections.js";
import { getAlbumKey } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { formatNum } from "../utils/format.js";

function appendLyricsExcerpt(panel, songOrSection, { accentColor } = {}) {
  const text = songOrSection?.text?.trim();
  if (!text) return;

  const albumColor =
    accentColor ??
    appState.albumColorScale(
      getAlbumKey(songOrSection._parentSong ?? songOrSection)
    );
  const primary = songOrSection.primary_emotion;
  const sectionLabel =
    songOrSection.section_type_label ||
    songOrSection.section_type ||
    "Section";
  const peakScore = formatNum(
    songOrSection.emotion_scores?.[primary] ?? songOrSection.primary_score
  );

  const block = panel.append("div").attr("class", "detail-lyrics");
  block.style("--lyrics-accent", albumColor);

  block
    .append("p")
    .attr("class", "detail-lyrics-caption")
    .text(`${sectionLabel} · ${primary} · score ${peakScore}`);

  block
    .append("div")
    .attr("class", "detail-lyrics-scroll")
    .append("blockquote")
    .attr("class", "detail-lyrics-quote")
    .text(text);
}

const SCORE_BAR_TRANSITION_MS = 650;
const NOTE_ICON_PATH =
  "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8z";

function scoreBarWidth(score) {
  return `${Math.min(100, Math.max(0, (score ?? 0) * 100))}%`;
}

function appendNoteIcon(fill) {
  fill
    .append("svg")
    .attr("class", "score-bar-note")
    .attr("viewBox", "0 0 24 24")
    .attr("aria-hidden", "true")
    .append("path")
    .attr("d", NOTE_ICON_PATH);
}

function updateEmotionBars(panel, scores, barColor, { animate = true } = {}) {
  let scoresBlock = panel.select(".detail-scores");
  if (scoresBlock.empty()) {
    scoresBlock = panel.append("div").attr("class", "detail-scores");
    scoresBlock.append("h4").text("Emotion scores");
  }

  scoresBlock.style("--score-bar-color", barColor);

  const rows = scoresBlock
    .selectAll(".score-bar-row")
    .data(PLUTCHIK_ORDER, (emotion) => emotion);

  const rowsEnter = rows.enter().append("div").attr("class", "score-bar-row");

  rowsEnter.append("span").attr("class", "score-bar-label");

  const fillEnter = rowsEnter
    .append("div")
    .attr("class", "score-bar-track")
    .append("div")
    .attr("class", "score-bar-fill")
    .style("width", "0%")
    .style("color", barColor)
    .style("background-color", barColor);

  appendNoteIcon(fillEnter);

  rowsEnter.append("span").attr("class", "score-bar-value").text(formatNum(0));

  const rowsMerge = rowsEnter.merge(rows);

  rowsMerge.select(".score-bar-label").text((emotion) => emotion);

  const fillSelection = rowsMerge.select(".score-bar-fill");
  const noteSelection = fillSelection.select(".score-bar-note");

  if (animate) {
    fillSelection
      .interrupt()
      .transition()
      .duration(SCORE_BAR_TRANSITION_MS)
      .ease(d3.easeCubicInOut)
      .style("width", (emotion) => scoreBarWidth(scores[emotion]))
      .style("color", barColor)
      .style("background-color", barColor);

    noteSelection
      .interrupt()
      .transition()
      .duration(SCORE_BAR_TRANSITION_MS)
      .ease(d3.easeCubicInOut)
      .style("opacity", (emotion) => ((scores[emotion] ?? 0) > 0.015 ? 1 : 0));

    rowsMerge
      .select(".score-bar-value")
      .interrupt()
      .transition()
      .duration(SCORE_BAR_TRANSITION_MS)
      .ease(d3.easeCubicInOut)
      .textTween(function (emotion) {
        const target = scores[emotion] ?? 0;
        const start = Number.parseFloat(this.textContent) || 0;
        const interp = d3.interpolateNumber(start, target);
        return (t) => formatNum(interp(t));
      });
  } else {
    fillSelection
      .style("width", (emotion) => scoreBarWidth(scores[emotion]))
      .style("color", barColor)
      .style("background-color", barColor);

    noteSelection.style(
      "opacity",
      (emotion) => ((scores[emotion] ?? 0) > 0.015 ? 1 : 0)
    );

    rowsMerge
      .select(".score-bar-value")
      .text((emotion) => formatNum(scores[emotion] ?? 0));
  }

  rows.exit().remove();
}

export function updateSectionDetailPanel(section, parentSong) {
  const panel = d3.select("#detail-panel");
  panel.selectAll("*").remove();

  if (!section) {
    panel.append("h3").text("Section");
    panel
      .append("p")
      .attr("class", "detail-placeholder")
      .text("Click a section point.");
    return;
  }

  const song = parentSong ?? appState.drilldownSong;
  const typeLabel =
    section.section_type_label || section.section_type || "Section";
  const typeColor = sectionTypeColor(
    appState.sectionTypeColorScale,
    section
  );
  panel.append("h3").text("Section");
  if (song) {
    panel.append("p").attr("class", "detail-parent-song").text(song.song_title);
  }

  panel
    .append("p")
    .attr("class", "detail-section-type")
    .style("--section-type-color", typeColor)
    .html(
      `<span class="detail-section-type-swatch"></span>${typeLabel}` +
        (section.section_index_in_song != null
          ? ` <span class="detail-section-index">#${section.section_index_in_song}</span>`
          : "")
    );

  const meta = panel.append("dl").attr("class", "detail-meta");
  const rows = [
    ["Section id", section.section_id],
    ["Primary emotion", section.primary_emotion],
    ["Primary score", formatNum(section.primary_score)],
  ];
  if (section.n_lyrics != null) {
    rows.push(["Lines", String(section.n_lyrics)]);
  }
  rows.forEach(([label, value]) => {
    meta.append("dt").text(`${label}: `);
    meta.append("dd").text(value ?? "—");
  });

  appendLyricsExcerpt(panel, section, { accentColor: typeColor });

  updateEmotionBars(panel, section.emotion_scores ?? {}, typeColor, {
    animate: false,
  });
}

function ensureDetailHeading(panel, text) {
  let heading = panel.select("h3");
  if (heading.empty()) heading = panel.append("h3");
  heading.text(text);
}

function ensureDetailText(panel, className, text) {
  let node = panel.select(`.${className}`);
  if (node.empty()) node = panel.append("p").attr("class", className);
  node.text(text);
}

function rebuildDetailMeta(panel, rows) {
  panel.select(".detail-meta").remove();
  const meta = panel.append("dl").attr("class", "detail-meta");
  rows.forEach(([label, value]) => {
    meta.append("dt").text(`${label}: `);
    meta.append("dd").text(value ?? "—");
  });
}

export function updateDetailPanel(song) {
  const panel = d3.select("#detail-panel");

  if (!song) {
    panel.selectAll("*").remove();
    panel.append("h3").text("Song Detail");
    panel
      .append("p")
      .attr("class", "detail-placeholder")
      .text("Click a song point to see details.");
    return;
  }

  panel.select(".detail-placeholder").remove();
  panel
    .selectAll(
      ".detail-parent-song, .detail-section-type, .detail-drill-hint-section"
    )
    .remove();

  ensureDetailHeading(panel, "Song Detail");
  ensureDetailText(panel, "detail-title", song.song_title);
  ensureDetailText(panel, "detail-album", getAlbumKey(song));

  rebuildDetailMeta(panel, [
    ["Primary emotion", song.primary_emotion],
    ["Primary score", formatNum(song.primary_score)],
  ]);

  panel.select(".detail-lyrics").remove();
  const peakSection = findPeakPrimarySection(song, appState.sectionsBySong);
  if (peakSection) {
    appendLyricsExcerpt(panel, peakSection);
  }

  const albumColor = appState.albumColorScale(getAlbumKey(song));
  updateEmotionBars(panel, song.emotion_scores_mean ?? {}, albumColor);

  panel.select(".detail-drill-hint").remove();
  panel
    .append("p")
    .attr("class", "detail-drill-hint")
    .text("Double-click this song on the wheel to explore its sections.");
}
