/**
 * Q8 — Song Structure "DNA strip".
 * Each row is one song; every section is a segment sized by its line count and
 * coloured by section type, revealing how songs are built. Rows can be grouped
 * by musical style to compare country / pop / indie-folk construction.
 */

import * as d3 from "d3";
import { STYLE_ORDER, STYLE_COLORS } from "../config/album-meta.js";
import { showTooltip, moveTooltip, hideTooltip } from "../ui/simple-tooltip.js";

export const SECTION_BUCKETS = [
  { key: "Verse", color: "#4a7fd4" },
  { key: "Chorus", color: "#d4536a" },
  { key: "Pre-Chorus", color: "#3db892" },
  { key: "Bridge", color: "#e6b54c" },
  { key: "Refrain", color: "#9b6fd0" },
  { key: "Intro / Outro", color: "#5bc6c0" },
];
const BUCKET_COLOR = new Map(SECTION_BUCKETS.map((b) => [b.key, b.color]));

function fractionOf(song, bucket) {
  if (!song.totalLines) return 0;
  return (
    d3.sum(song.segments.filter((s) => s.bucket === bucket), (s) => s.lines) /
    song.totalLines
  );
}

function sortSongs(songs, sortBy) {
  const arr = [...songs];
  switch (sortBy) {
    case "chorus":
      return arr.sort((a, b) => fractionOf(b, "Chorus") - fractionOf(a, "Chorus"));
    case "verse":
      return arr.sort((a, b) => fractionOf(b, "Verse") - fractionOf(a, "Verse"));
    case "bridge":
      return arr.sort((a, b) => fractionOf(b, "Bridge") - fractionOf(a, "Bridge"));
    case "length":
      return arr.sort((a, b) => b.totalLines - a.totalLines);
    default:
      return arr; // album order (already sorted upstream)
  }
}

export function renderDnaStrip(container, songs, { sortBy = "album", groupByStyle = false } = {}) {
  const margin = { top: 8, right: 24, bottom: 8, left: 196 };
  const rowH = 15;
  const rowGap = 2;
  const groupGap = 30;
  const width = 1240;
  const stripW = width - margin.left - margin.right;

  // Build ordered groups.
  let groups;
  if (groupByStyle) {
    const byStyle = d3.group(songs, (s) => s.style);
    groups = STYLE_ORDER.filter((st) => byStyle.has(st)).map((st) => ({
      label: st,
      songs: sortSongs(byStyle.get(st), sortBy),
    }));
  } else {
    groups = [{ label: null, songs: sortSongs(songs, sortBy) }];
  }

  let y = margin.top;
  const layout = [];
  groups.forEach((g, gi) => {
    if (g.label) y += gi === 0 ? 6 : groupGap;
    const headerY = g.label ? y : null;
    if (g.label) y += 22;
    g.songs.forEach((song) => {
      layout.push({ song, y });
      y += rowH + rowGap;
    });
    g.headerY = headerY;
  });
  const height = y + margin.bottom;

  const xLen = d3
    .scaleLinear()
    .domain([0, d3.max(songs, (s) => s.totalLines)])
    .range([0, stripW]);

  container.innerHTML = "";
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("role", "img")
    .attr("aria-label", "Song structure DNA strips");

  // Group headers (style bands).
  groups.forEach((g) => {
    if (!g.label) return;
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", g.headerY)
      .attr("width", 6)
      .attr("height", 16)
      .attr("fill", STYLE_COLORS[g.label] || "var(--accent)");
    svg
      .append("text")
      .attr("x", 14)
      .attr("y", g.headerY + 13)
      .attr("font-family", "var(--font-serif)")
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .attr("fill", "var(--text)")
      .text(`${g.label} · ${g.songs.length} songs`);
  });

  const rows = svg
    .selectAll("g.dna-row")
    .data(layout, (d) => d.song.songId)
    .join("g")
    .attr("class", "dna-row")
    .attr("transform", (d) => `translate(0 ${d.y})`);

  // Song label.
  rows
    .append("text")
    .attr("x", margin.left - 10)
    .attr("y", rowH / 2 + 4)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "var(--text-muted)")
    .text((d) => {
      const t = d.song.title;
      return t.length > 26 ? `${t.slice(0, 25)}…` : t;
    });

  // Segments.
  rows.each(function (d) {
    const row = d3.select(this);
    let cx = margin.left;
    d.song.segments.forEach((seg) => {
      const w = xLen(seg.lines);
      row
        .append("rect")
        .attr("x", cx)
        .attr("y", 0)
        .attr("width", Math.max(0.6, w - 0.6))
        .attr("height", rowH)
        .attr("fill", BUCKET_COLOR.get(seg.bucket) || "#9a9088")
        .attr("data-song", d.song.songId)
        .on("mouseenter", (event) =>
          showTooltip(
            `<strong>${d.song.title}</strong><br>${seg.bucket} · ${seg.lines} line${seg.lines === 1 ? "" : "s"}` +
              `<br><span class="tooltip-sub">${d.song.totalLines} lines total${d.song.fromVault ? " · ★ Vault" : ""}</span>`,
            event
          )
        )
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);
      cx += w;
    });
    if (d.song.fromVault) {
      row
        .append("text")
        .attr("x", cx + 4)
        .attr("y", rowH / 2 + 4)
        .attr("font-size", 10)
        .attr("fill", "#8e5bb5")
        .text("★");
    }
  });
}
