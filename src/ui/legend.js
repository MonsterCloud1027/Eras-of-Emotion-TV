import * as d3 from "d3";
import { appState } from "../state/app-state.js";
import {
  isDarkAlbumColor,
  SPARKLE_MUTED_STROKE,
  TABLER_SPARKLE_D,
} from "../viz/wheel.js";
import { applyAlbumHighlight, pickScrollFocusAlbum } from "../viz/highlight.js";
import { scrollToAlbum, scrollToGlobal } from "./scroll-controller.js";

function appendLegendSparkle(parent, color) {
  const svg = parent
    .append("svg")
    .attr("class", "legend-sparkle")
    .attr("width", 12)
    .attr("height", 12)
    .attr("viewBox", "0 0 24 24")
    .attr("aria-hidden", "true");

  const path = svg.append("path").attr("d", TABLER_SPARKLE_D).attr("fill", color);
  if (isDarkAlbumColor(color)) {
    path
      .attr("stroke", SPARKLE_MUTED_STROKE)
      .attr("stroke-width", 1.25)
      .attr("stroke-linejoin", "round");
  }
}

function isFilterMode() {
  const legend = document.getElementById("album-legend");
  return legend?.classList.contains("legend-mode--filter") ?? true;
}

export function refreshFilterLegendActive() {
  const highlight = appState.selectedAlbumHighlight;
  d3.selectAll("#album-legend .legend-item")
    .classed("active", false)
    .classed("active-nav", false)
    .style("border-color", null)
    .style("box-shadow", null);
  d3.selectAll("#album-legend .legend-item").classed(
    "active",
    function () {
      return d3.select(this).attr("data-album") === highlight;
    }
  );
  d3.select("#album-legend .legend-all")
    .classed("active", !highlight)
    .classed("active-nav", false);
}

export function refreshNavLegendActive(focusAlbum) {
  d3.selectAll("#album-legend .legend-item").classed("active", false);
  d3.select("#album-legend .legend-all")
    .classed("active", false)
    .classed("active-nav", !focusAlbum);

  d3.selectAll("#album-legend .legend-item").each(function () {
    const album = d3.select(this).attr("data-album");
    const active = focusAlbum != null && album === focusAlbum;
    const el = d3.select(this);
    el.classed("active-nav", active);
    if (active && appState.albumColorScale) {
      const color = appState.albumColorScale(album);
      el.style("border-color", color).style("box-shadow", `0 0 0 1px ${color}55`);
    } else {
      el.style("border-color", null).style("box-shadow", null);
    }
  });
}

export function updateLegendFromScroll(opacityByKey, albumOrder = []) {
  const legend = document.getElementById("album-legend");
  if (!legend) return;

  const focusAlbum = pickScrollFocusAlbum(opacityByKey, albumOrder);
  const filterMode = focusAlbum == null;
  legend.classList.toggle("legend-mode--filter", filterMode);
  legend.classList.toggle("legend-mode--navigate", !filterMode);

  const hint = legend.querySelector(".legend-hint");
  if (hint) {
    hint.textContent = filterMode
      ? "Filter songs on the wheel"
      : "Jump to an album section";
  }

  const allBtn = legend.querySelector(".legend-all");
  if (allBtn) {
    allBtn.textContent = filterMode ? "All albums" : "Global galaxy";
  }

  if (filterMode) {
    refreshFilterLegendActive();
  } else {
    refreshNavLegendActive(focusAlbum);
  }
}

function onLegendAllClick() {
  if (isFilterMode()) {
    applyAlbumHighlight(null);
    refreshFilterLegendActive();
  } else {
    scrollToGlobal();
  }
}

function onLegendAlbumClick(album) {
  if (isFilterMode()) {
    const next =
      appState.selectedAlbumHighlight === album ? null : album;
    applyAlbumHighlight(next);
    refreshFilterLegendActive();
  } else {
    scrollToAlbum(album);
  }
}

export function drawAlbumLegend(groupedData) {
  const container = d3.select("#album-legend");
  container.selectAll("*").remove();
  container
    .attr("class", "album-legend album-rail legend-mode--filter")
    .classed("legend-mode--navigate", false);

  container.append("p").attr("class", "legend-title").text("Albums");
  container
    .append("p")
    .attr("class", "legend-hint")
    .text("Filter songs on the wheel");

  container
    .append("button")
    .attr("type", "button")
    .attr("class", "legend-all active")
    .text("All albums")
    .on("click", onLegendAllClick);

  const itemsWrap = container.append("div").attr("class", "legend-items");

  const albums = [...groupedData.keys()];
  itemsWrap
    .selectAll("button")
    .data(albums)
    .join("button")
    .attr("type", "button")
    .attr("class", "legend-item")
    .attr("data-album", (d) => d)
    .on("click", (_event, album) => onLegendAlbumClick(album))
    .each(function (album) {
      const btn = d3.select(this);
      appendLegendSparkle(btn, appState.albumColorScale(album));
      btn.append("span").attr("class", "legend-label").text(album);
    });
}
