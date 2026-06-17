/**
 * Q7 — Vocabulary Complexity River.
 * Stacked-area (100%) of CEFR levels across albums, with a "full breakdown"
 * vs "above A1 only" zoom, plus a CEFR-score trend line beneath.
 */

import * as d3 from "d3";
import { CEFR_LEVELS } from "../data/corpus.js";
import { showTooltip, moveTooltip, hideTooltip } from "../ui/simple-tooltip.js";

const CEFR_INFO = {
  A1: { label: "A1 — Elementary", color: "#b9a7e0" },
  A2: { label: "A2 — Pre-intermediate", color: "#6aa9e0" },
  B1: { label: "B1 — Intermediate", color: "#41c0a8" },
  B2: { label: "B2 — Upper-intermediate", color: "#e6b54c" },
  C1: { label: "C1 — Advanced", color: "#e1607f" },
};

export function renderRiver(container, data, { mode = "full" } = {}) {
  const albums = data.albums;
  const levels = mode === "above" ? CEFR_LEVELS.slice(1) : CEFR_LEVELS;

  // Normalise each album's distribution over the visible levels.
  const rows = albums.map((a) => {
    const total = d3.sum(levels, (l) => a.cefrDist[l]) || 1;
    const row = { code: a.code, short: a.short, year: a.year, avgCefr: a.avgCefr };
    levels.forEach((l) => {
      row[l] = a.cefrDist[l] / total;
    });
    return row;
  });

  const margin = { top: 20, right: 24, bottom: 132, left: 52 };
  const width = 1180;
  const height = 620;
  const plotH = height - margin.top - margin.bottom;
  const trendH = 70;
  const trendTop = margin.top + plotH + 38;

  container.innerHTML = "";
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("role", "img")
    .attr("aria-label", "Vocabulary complexity river across albums");

  const x = d3
    .scalePoint()
    .domain(albums.map((a) => a.code))
    .range([margin.left, width - margin.right])
    .padding(0);
  const y = d3.scaleLinear().domain([0, 1]).range([margin.top + plotH, margin.top]);

  const stack = d3.stack().keys(levels).order(d3.stackOrderReverse);
  const series = stack(rows);

  const area = d3
    .area()
    .x((d) => x(d.data.code))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveBasis);

  // Y grid + ticks.
  const gridG = svg.append("g").attr("class", "la-axis");
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    gridG
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(t))
      .attr("y2", y(t))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "3 4");
    gridG
      .append("text")
      .attr("x", margin.left - 8)
      .attr("y", y(t) + 3)
      .attr("text-anchor", "end")
      .text(`${Math.round(t * 100)}%`);
  });

  svg
    .append("g")
    .selectAll("path")
    .data(series)
    .join("path")
    .attr("fill", (d) => CEFR_INFO[d.key].color)
    .attr("opacity", 0.92)
    .attr("d", area)
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("opacity", 1);
    })
    .on("mousemove", function (event, d) {
      const code = nearestAlbum(event);
      const row = rows.find((r) => r.code === code);
      if (row) {
        showTooltip(
          `<strong>${row.short}</strong> · ${row.year}<br>${CEFR_INFO[d.key].label}<br>` +
            `share of ${mode === "above" ? "above-A1" : "all"} vocab: <b>${(row[d.key] * 100).toFixed(1)}%</b>`,
          event
        );
      }
    })
    .on("mouseleave", function () {
      d3.select(this).attr("opacity", 0.92);
      hideTooltip();
    });

  // X labels on the plot baseline.
  const xAxisG = svg.append("g").attr("class", "la-axis");
  albums.forEach((a) => {
    xAxisG
      .append("text")
      .attr("x", x(a.code))
      .attr("y", margin.top + plotH + 18)
      .attr("text-anchor", "middle")
      .text(a.year);
  });

  // CEFR-score trend line beneath the river.
  const ext = d3.extent(rows, (r) => r.avgCefr);
  const yTrend = d3
    .scaleLinear()
    .domain([ext[0] - 0.01, ext[1] + 0.01])
    .range([trendTop + trendH, trendTop]);

  const trendG = svg.append("g");
  const trendArea = d3
    .area()
    .x((d) => x(d.code))
    .y0(trendTop + trendH)
    .y1((d) => yTrend(d.avgCefr))
    .curve(d3.curveCatmullRom);
  const trendLine = d3
    .line()
    .x((d) => x(d.code))
    .y((d) => yTrend(d.avgCefr))
    .curve(d3.curveCatmullRom);

  trendG
    .append("path")
    .datum(rows)
    .attr("fill", "#b9a7e0")
    .attr("opacity", 0.3)
    .attr("d", trendArea);
  trendG
    .append("path")
    .datum(rows)
    .attr("fill", "none")
    .attr("stroke", "#4a3f6b")
    .attr("stroke-width", 2.5)
    .attr("d", trendLine);

  trendG
    .selectAll("circle")
    .data(rows)
    .join("circle")
    .attr("cx", (d) => x(d.code))
    .attr("cy", (d) => yTrend(d.avgCefr))
    .attr("r", 4)
    .attr("fill", "#4a3f6b")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) =>
      showTooltip(
        `<strong>${d.short}</strong> · ${d.year}<br>avg CEFR score: <b>${d.avgCefr.toFixed(3)}</b>`,
        event
      )
    )
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  trendG
    .append("text")
    .attr("x", margin.left)
    .attr("y", trendTop - 8)
    .attr("font-size", 11)
    .attr("fill", "var(--text-muted)")
    .text("CEFR score (avg word level) per album →");

  // Diagonal album names under the trend.
  const namesG = svg.append("g");
  albums.forEach((a) => {
    namesG
      .append("text")
      .attr("transform", `translate(${x(a.code)} ${trendTop + trendH + 14}) rotate(28)`)
      .attr("font-size", 11)
      .attr("fill", "var(--text-muted)")
      .text(a.short);
  });

  function nearestAlbum(event) {
    const [mx] = d3.pointer(event, svg.node());
    let best = albums[0].code;
    let bestD = Infinity;
    albums.forEach((a) => {
      const d = Math.abs(x(a.code) - mx);
      if (d < bestD) {
        bestD = d;
        best = a.code;
      }
    });
    return best;
  }
}

export { CEFR_INFO };
