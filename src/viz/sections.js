import * as d3 from "d3";
import {
  getMostFrequentPrimaryEmotion,
  getStrongestSong,
  getTopEmotions,
} from "../data/analytics.js";
import { groupSongsByAlbum, sortSongsWithinAlbum } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { albumSlug, formatNum } from "../utils/format.js";
import { drawAlbumPaths, drawSongPoints } from "./layers.js";
import {
  createWheelScales,
  drawWheelBackground,
  ensureWheelDefs,
} from "./wheel.js";

export function drawAlbumMiniWheel(albumSongs, container, albumName) {
  const node =
    typeof container === "string"
      ? document.querySelector(container)
      : container.node?.() || container;
  const wrap = d3.select(node);
  wrap.selectAll("*").remove();

  const size = 320;
  const wheelRadius = size * 0.34;
  const centerX = size / 2;
  const centerY = size / 2;

  const svg = wrap
    .append("svg")
    .attr("viewBox", `0 0 ${size} ${size}`)
    .attr("width", size)
    .attr("height", size);

  const idPrefix = `album-${albumName.replace(/\W+/g, "-").slice(0, 24)}`;
  const { sizeScale, innerRadius, outerRadius } = createWheelScales(
    wheelRadius,
    albumSongs,
    [3, 12]
  );
  const { clipId, glowId } = ensureWheelDefs(svg, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    idPrefix,
  });

  drawWheelBackground(svg, {
    centerX,
    centerY,
    wheelRadius,
    labelClass: "wheel-label",
    idPrefix,
  });

  const albumGrouped = new Map([[albumName, sortSongsWithinAlbum(albumSongs)]]);

  drawAlbumPaths(svg, albumGrouped, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    clipId,
    opacity: 0.55,
    strokeWidth: 2.5,
    routeAroundHole: true,
  });

  drawSongPoints(svg, albumSongs, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    glowId,
    defaultOpacity: 0.85,
    interactive: false,
  });
}

function renderSongCard(container, song) {
  const top3 = getTopEmotions(song.emotion_scores_mean, 3);
  const card = container.append("article").attr("class", "song-card");
  card.append("h4").attr("class", "song-card-title").text(song.song_title);
  card.append("p").attr("class", "song-card-id").text(song.song_id);
  card
    .append("p")
    .attr("class", "song-card-primary")
    .html(
      `<strong>${song.primary_emotion}</strong> · ${formatNum(song.primary_score)}`
    );
  card.append("p").text(`Lyrics sections: ${song.n_lyrics ?? "—"}`);
  const ul = card.append("ul").attr("class", "song-card-top3");
  top3.forEach(({ emotion, score }) => {
    ul.append("li").text(`${emotion} ${formatNum(score)}`);
  });
}

export function drawAlbumSections(data) {
  const grouped = groupSongsByAlbum(data);
  const root = d3.select("#album-sections");
  root.selectAll("*").remove();

  for (const [albumName, songs] of grouped) {
    const freq = getMostFrequentPrimaryEmotion(songs);
    const strongest = getStrongestSong(songs);
    const color = appState.albumColorScale(albumName);

    const section = root
      .append("section")
      .attr("class", "album-section")
      .attr("id", albumSlug(albumName));

    const header = section.append("div").attr("class", "album-section-header");
    header
      .append("h2")
      .attr("class", "album-section-title")
      .style("color", color)
      .text(albumName);

    header
      .append("p")
      .attr("class", "album-section-summary")
      .html(
        `${songs.length} songs · ` +
          `most frequent primary emotion: <strong>${freq ?? "—"}</strong> · ` +
          `strongest: <strong>${strongest?.song_title ?? "—"}</strong> ` +
          `(${formatNum(strongest?.primary_score)})`
      );

    const body = section.append("div").attr("class", "album-section-body");

    const miniWrap = body.append("div").attr("class", "mini-wheel-wrap");
    drawAlbumMiniWheel(songs, miniWrap.node(), albumName);

    const cards = body.append("div").attr("class", "song-cards");
    sortSongsWithinAlbum(songs).forEach((song) => renderSongCard(cards, song));
  }
}
