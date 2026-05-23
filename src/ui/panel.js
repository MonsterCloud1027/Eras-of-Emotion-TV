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

function appendEmotionBars(panel, scores, barColor) {
  const scoresBlock = panel.append("div").attr("class", "detail-scores");
  scoresBlock.append("h4").text("Emotion scores");
  PLUTCHIK_ORDER.forEach((emotion) => {
    const val = scores[emotion] ?? 0;
    const row = scoresBlock.append("div").attr("class", "score-bar-row");
    row.append("span").attr("class", "score-bar-label").text(emotion);
    const track = row.append("div").attr("class", "score-bar-track");
    track
      .append("div")
      .attr("class", "score-bar-fill")
      .style("width", `${Math.min(100, val * 100)}%`)
      .style("background", barColor);
    row.append("span").attr("class", "score-bar-value").text(formatNum(val));
  });
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

  appendEmotionBars(panel, section.emotion_scores ?? {}, typeColor);
}

export function updateDetailPanel(song) {
  const panel = d3.select("#detail-panel");
  panel.selectAll("*").remove();

  if (!song) {
    panel.append("h3").text("Song Detail");
    panel
      .append("p")
      .attr("class", "detail-placeholder")
      .text("Click a song point to see details.");
    return;
  }

  panel.append("h3").text("Song Detail");
  panel.append("p").attr("class", "detail-title").text(song.song_title);
  panel.append("p").attr("class", "detail-album").text(getAlbumKey(song));

  const meta = panel.append("dl").attr("class", "detail-meta");
  const rows = [
    ["Primary emotion", song.primary_emotion],
    ["Primary score", formatNum(song.primary_score)],
  ];
  rows.forEach(([label, value]) => {
    meta.append("dt").text(`${label}: `);
    meta.append("dd").text(value ?? "—");
  });

  const peakSection = findPeakPrimarySection(song, appState.sectionsBySong);
  if (peakSection) {
    appendLyricsExcerpt(panel, peakSection);
  }

  const albumColor = appState.albumColorScale(getAlbumKey(song));
  appendEmotionBars(panel, song.emotion_scores_mean ?? {}, albumColor);

  panel
    .append("p")
    .attr("class", "detail-drill-hint")
    .text("Double-click this song on the wheel to explore its sections.");
}
