/**
 * Q7 — Lyrical complexity dot-matrix.
 * Each circle = one song, placed in its album column and CEFR-complexity band
 * (y). Colour encodes average OEC rank (darker = rarer vocabulary).
 */

import * as d3 from "d3";
import { ALBUM_META } from "../config/album-meta.js";
import { showTooltip, moveTooltip, hideTooltip } from "../ui/simple-tooltip.js";

/** CEFR complexity bands (matches the per-song avg-word-level scale). */
const BANDS = [
  { id: "core", label: "Core A1", sub: "< 1.10", lo: -Infinity, hi: 1.1 },
  { id: "mid", label: "Mid A1", sub: "1.10 – 1.20", lo: 1.1, hi: 1.2 },
  { id: "midplus", label: "Mid A1+", sub: "1.20 – 1.30", lo: 1.2, hi: 1.3 },
  { id: "upper", label: "Upper A1", sub: "1.30 – 1.40", lo: 1.3, hi: 1.4 },
  { id: "a2", label: "A2", sub: "≥ 1.40", lo: 1.4, hi: Infinity },
];

function bandIndex(cefrAvg) {
  for (let i = 0; i < BANDS.length; i += 1) {
    if (cefrAvg >= BANDS[i].lo && cefrAvg < BANDS[i].hi) return i;
  }
  return BANDS.length - 1;
}

export function renderDotMatrix(container, data) {
  const songs = data.songs.filter((s) => s.cefrAvg != null);
  const albums = data.albums;
  const oecExtent = d3.extent(songs, (s) => s.oecAvg);
  const color = d3
    .scaleSequential(d3.interpolateRgbBasis(["#f6d9e2", "#d36a8e", "#7c1f44"]))
    .domain(oecExtent);

  const margin = { top: 28, right: 168, bottom: 64, left: 118 };
  const colW = 118;
  const width = margin.left + margin.right + albums.length * colW;
  const rowH = 96;
  const height = margin.top + margin.bottom + BANDS.length * rowH;

  container.innerHTML = "";
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("role", "img")
    .attr("aria-label", "Song lyrical complexity by album and CEFR band");

  const x = d3
    .scalePoint()
    .domain(albums.map((a) => a.code))
    .range([margin.left, width - margin.right])
    .padding(0.5);

  const yBand = (i) => margin.top + i * rowH;

  // Album-tinted column backgrounds.
  const cellW = (x.step ? x.step() : colW) * 0.92;
  svg
    .append("g")
    .selectAll("rect")
    .data(albums)
    .join("rect")
    .attr("x", (d) => x(d.code) - cellW / 2)
    .attr("y", margin.top)
    .attr("width", cellW)
    .attr("height", BANDS.length * rowH)
    .attr("rx", 8)
    .attr("fill", (d) => d.color)
    .attr("opacity", 0.12);

  // Horizontal band separators + labels.
  const bands = svg.append("g");
  BANDS.forEach((b, i) => {
    if (i > 0) {
      bands
        .append("line")
        .attr("x1", margin.left - 8)
        .attr("x2", width - margin.right + 8)
        .attr("y1", yBand(i))
        .attr("y2", yBand(i))
        .attr("stroke", "var(--border)")
        .attr("stroke-dasharray", "2 4");
    }
    bands
      .append("text")
      .attr("class", "la-band-label")
      .attr("x", margin.left - 16)
      .attr("y", yBand(i) + rowH / 2 - 4)
      .attr("text-anchor", "end")
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .text(b.label);
    bands
      .append("text")
      .attr("class", "la-band-sub")
      .attr("x", margin.left - 16)
      .attr("y", yBand(i) + rowH / 2 + 12)
      .attr("text-anchor", "end")
      .text(b.sub);
  });

  // Y axis title.
  svg
    .append("text")
    .attr("transform", `translate(22 ${margin.top + (BANDS.length * rowH) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("class", "la-band-label")
    .attr("font-size", 13)
    .attr("fill", "var(--accent)")
    .text("CEFR Complexity Level");

  // Album column labels.
  const cols = svg.append("g");
  albums.forEach((a) => {
    cols
      .append("text")
      .attr("x", x(a.code))
      .attr("y", height - margin.bottom + 24)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "var(--text)")
      .text(a.short);
    cols
      .append("text")
      .attr("x", x(a.code))
      .attr("y", height - margin.bottom + 40)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "var(--text-muted)")
      .text(a.year);
  });
  svg
    .append("text")
    .attr("x", margin.left + (width - margin.left - margin.right) / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "var(--text-muted)")
    .text("← Album Release Progression →");

  // Beeswarm-pack the songs within each album column / band cell.
  const byCell = d3.group(
    songs,
    (s) => s.code,
    (s) => bandIndex(s.cefrAvg)
  );
  const r = 7;
  const placed = [];
  byCell.forEach((bandMap, code) => {
    bandMap.forEach((cellSongs, bi) => {
      const cx = x(code);
      const top = yBand(bi);
      const perRow = Math.max(1, Math.floor(cellW / (r * 2 + 2)));
      cellSongs
        .sort((a, b) => a.oecAvg - b.oecAvg)
        .forEach((s, idx) => {
          const rowInCell = Math.floor(idx / perRow);
          const colInCell = idx % perRow;
          const countThisRow = Math.min(perRow, cellSongs.length - rowInCell * perRow);
          const rowWidth = countThisRow * (r * 2 + 2);
          placed.push({
            ...s,
            px: cx - rowWidth / 2 + colInCell * (r * 2 + 2) + r + 1,
            py: top + 18 + rowInCell * (r * 2 + 3),
          });
        });
    });
  });

  svg
    .append("g")
    .selectAll("circle")
    .data(placed)
    .join("circle")
    .attr("cx", (d) => d.px)
    .attr("cy", (d) => d.py)
    .attr("r", r)
    .attr("fill", (d) => color(d.oecAvg))
    .attr("stroke", (d) => (d.fromVault ? "#8e5bb5" : "rgba(0,0,0,0.18)"))
    .attr("stroke-width", (d) => (d.fromVault ? 2 : 0.75))
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("stroke", "#2c2416").attr("stroke-width", 2);
      showTooltip(
        `<strong>${d.title}</strong>${d.fromVault ? ' <span class="la-from-vault">★ Vault</span>' : ""}<br>` +
          `CEFR complexity: <b>${d.cefrAvg.toFixed(3)}</b><br>` +
          `avg OEC rank: <b>${d.oecAvg ? d.oecAvg.toFixed(1) : "–"}</b> (${d.oecAvg > 30 ? "rarer" : "common"})`,
        event
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function (event, d) {
      d3.select(this)
        .attr("stroke", d.fromVault ? "#8e5bb5" : "rgba(0,0,0,0.18)")
        .attr("stroke-width", d.fromVault ? 2 : 0.75);
      hideTooltip();
    });

  renderOecLegend(svg, width - margin.right + 32, margin.top + 4, color, oecExtent);
}

function renderOecLegend(svg, lx, ly, color, extent) {
  const g = svg.append("g").attr("transform", `translate(${lx} ${ly})`);
  g.append("text")
    .attr("font-size", 13)
    .attr("font-weight", 700)
    .attr("fill", "var(--text)")
    .text("OEC Rank");
  g.append("text")
    .attr("y", 16)
    .attr("font-size", 10)
    .attr("fill", "var(--text-muted)")
    .text("avg. word frequency rank");

  const barH = 150;
  const barW = 14;
  const top = 28;
  const defs = svg.append("defs");
  const gradId = "oec-grad";
  const grad = defs
    .append("linearGradient")
    .attr("id", gradId)
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 1);
  d3.range(0, 1.01, 0.1).forEach((t) => {
    grad
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(extent[1] - t * (extent[1] - extent[0])));
  });
  g.append("rect")
    .attr("y", top)
    .attr("width", barW)
    .attr("height", barH)
    .attr("rx", 3)
    .attr("fill", `url(#${gradId})`);
  [
    ["Rarer", extent[1], top + 6],
    ["", (extent[0] + extent[1]) / 2, top + barH / 2],
    ["Common", extent[0], top + barH],
  ].forEach(([label, val, yy]) => {
    g.append("text")
      .attr("x", barW + 8)
      .attr("y", yy + 3)
      .attr("font-size", 11)
      .attr("fill", "var(--text-muted)")
      .text(label ? `${label} (${val.toFixed(0)})` : val.toFixed(0));
  });

  // Vault marker.
  const vy = top + barH + 34;
  g.append("circle")
    .attr("cx", barW / 2)
    .attr("cy", vy)
    .attr("r", 7)
    .attr("fill", "#f6d9e2")
    .attr("stroke", "#8e5bb5")
    .attr("stroke-width", 2);
  g.append("text")
    .attr("x", barW + 8)
    .attr("y", vy + 4)
    .attr("font-size", 11)
    .attr("fill", "var(--text-muted)")
    .html("★ From The Vault");
}
