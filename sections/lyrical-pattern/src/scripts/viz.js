"use strict";

import * as d3 from "d3";

import { loadHeatmapData, heatMetrics, eraHueScale, eraSolidColor } from "./data.js";
import { showTip, hideTip } from "./hover.js";

let renderId = 0;


function formatValue(metric, value) {
  if (!Number.isFinite(value)) return "n/a";
  if (metric.percent) return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

export async function drawHeatmap() {
  const currentRenderId = ++renderId;
  const data = await loadHeatmapData();
  if (currentRenderId !== renderId) return;

  const svg = d3.select("#chart-q8");
  svg.selectAll("*").remove();

  const width = Math.min(1140, window.innerWidth - 48);
  const cellH = 54;
  const margin = { top: 40, right: 150, bottom: 90, left: 160 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = heatMetrics.length * cellH;
  const height = innerHeight + margin.top + margin.bottom;

  svg.attr("width", width).attr("height", height);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.name)).range([0, innerWidth]).padding(0.06);
  const y = d3.scaleBand().domain(heatMetrics.map(m => m.label)).range([0, innerHeight]).padding(0.06);

  const normalised = {};
  heatMetrics.forEach(m => {
    const vals = data.map(d => d[m.key]);
    const minVal = d3.min(vals), maxVal = d3.max(vals);
    normalised[m.label] = {};
    data.forEach(d => {
      let v = (d[m.key] - minVal) / ((maxVal - minVal) || 1);
      if (m.invert) v = 1 - v;
      normalised[m.label][d.code] = v;
    });
  });

  heatMetrics.forEach(m => {
    data.forEach(d => {
      const v = normalised[m.label][d.code];
      const cellColor = eraHueScale[d.era](0.1 + v * 0.9);

      const cell = g.append("rect")
        .attr("x", x(d.name)).attr("y", y(m.label))
        .attr("width", x.bandwidth()).attr("height", y.bandwidth())
        .attr("rx", 4).style("fill", cellColor);

      cell
        .on("mousemove", (e) => {
          const raw = d[m.key];
          showTip(`<strong>${d.name}</strong><br>Era: ${d.era}<br>${m.label}<br>Value: <b>${formatValue(m, raw)}</b><br>Relative Scale: <b>${(v * 100).toFixed(0)}%</b>`, e);
          cell.style("opacity", 0.7);
        })
        .on("mouseleave", () => { hideTip(); cell.style("opacity", 1); });

      g.append("text")
        .attr("x", x(d.name) + x.bandwidth() / 2)
        .attr("y", y(m.label) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "middle")
        .style("fill", v > 0.45 ? "#fff" : "#111")
        .style("font-size", "10px").style("font-weight", "500")
        .style("pointer-events", "none")
        .text((v * 100).toFixed(0) + "%");
    });
  });

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text").attr("transform", "rotate(-25)").style("text-anchor", "end")
    .style("fill", "#bbb").style("font-size", "10.5px");
  g.select(".domain").style("stroke", "#333");

  g.append("g").call(d3.axisLeft(y))
    .selectAll("text").style("fill", "#bbb").style("font-size", "10.5px");

  data.forEach(d => {
    g.append("rect")
      .attr("x", x(d.name)).attr("y", -14)
      .attr("width", x.bandwidth()).attr("height", 8)
      .attr("rx", 2).style("fill", eraSolidColor[d.era]).style("opacity", 0.8);
  });

  const leg = document.getElementById("heatmap-legend");
  leg.innerHTML = "";
  Object.keys(eraHueScale).forEach(era => {
    leg.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${eraSolidColor[era]}"></div><span>${era}</span></div>`;
  });

  const cbW = 12, cbH = innerHeight;
  const defs = svg.append("defs");
  const eras = Object.keys(eraHueScale);

  eras.forEach((era, i) => {
    const lg = defs.append("linearGradient").attr("id", `cb-grad-${i}`).attr("x1", "0").attr("x2", "0").attr("y1", "1").attr("y2", "0");
    lg.append("stop").attr("offset", "0%").attr("stop-color", eraHueScale[era](0.1));
    lg.append("stop").attr("offset", "100%").attr("stop-color", eraHueScale[era](1));

    svg.append("rect")
       .attr("x", margin.left + innerWidth + 20 + (i * 16))
       .attr("y", margin.top)
       .attr("width", cbW)
       .attr("height", cbH)
       .style("fill", `url(#cb-grad-${i})`)
       .attr("rx", 3);
  });

  svg.append("text").attr("x", margin.left + innerWidth + 20).attr("y", margin.top - 8)
    .style("fill", "#777").style("font-size", "9.5px").text("High (Dark)");
  svg.append("text").attr("x", margin.left + innerWidth + 20).attr("y", margin.top + cbH + 16)
    .style("fill", "#777").style("font-size", "9.5px").text("Low (Light)");
}
