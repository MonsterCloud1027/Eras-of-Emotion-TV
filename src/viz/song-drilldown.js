import * as d3 from "d3";
import { sectionTypeColor } from "../config/section-type-colors.js";
import { getSongSectionsForDrilldown } from "../data/section-wheel.js";
import { getAlbumKey } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { updateDetailPanel, updateSectionDetailPanel } from "../ui/panel.js";
import { drawSectionPoints } from "./layers.js";
import { createWheelScales } from "./wheel.js";

function setMainLayersHidden(hidden) {
  const layers = appState.overviewLayers;
  if (!layers) return;

  const opacity = hidden ? 0 : null;
  const pe = hidden ? "none" : "all";

  if (hidden) {
    layers.globalLayer.attr("opacity", 0).style("pointer-events", "none");
    for (const { layer } of layers.albumLayers.values()) {
      layer.attr("opacity", 0).style("pointer-events", "none");
    }
    return;
  }

  if (layers._savedLayerOpacity) {
    const saved = layers._savedLayerOpacity;
    layers.globalLayer
      .attr("opacity", saved.global)
      .style("pointer-events", saved.global > 0.08 ? "all" : "none");
    for (const [album, { layer }] of layers.albumLayers) {
      const op = saved.albums[album] ?? 0;
      layer
        .attr("opacity", op)
        .style("pointer-events", op > 0.08 ? "all" : "none");
    }
    if (layers.centerImagesG && saved.center != null) {
      const { centerX, centerY } = layers;
      layers.centerImagesG.selectAll(".center-logo-wrap").each(function () {
        const wrap = d3.select(this);
        const layerKey =
          wrap.attr("data-layer-key") === "global"
            ? "global"
            : wrap.attr("data-album");
        const opacity = saved.center.layers?.[layerKey] ?? 0;
        const angle = saved.center.rotations?.[layerKey] ?? 0;
        wrap
          .attr("opacity", opacity)
          .attr("transform", `rotate(${angle} ${centerX} ${centerY})`);
      });
    }
    delete layers._savedLayerOpacity;
  }
}

function saveLayerOpacitySnapshot() {
  const layers = appState.overviewLayers;
  if (!layers) return;

  const albums = {};
  for (const [album, { layer }] of layers.albumLayers) {
    albums[album] = Number(layer.attr("opacity")) || 0;
  }

  const center = { layers: {}, rotations: {} };
  if (layers.centerImagesG) {
    layers.centerImagesG.selectAll(".center-logo-wrap").each(function () {
      const wrap = d3.select(this);
      const layerKey =
        wrap.attr("data-layer-key") === "global"
          ? "global"
          : wrap.attr("data-album");
      center.layers[layerKey] = Number(wrap.attr("opacity")) || 0;
      const transform = wrap.attr("transform") || "";
      const match = transform.match(/rotate\(([-\d.]+)/);
      center.rotations[layerKey] = match ? Number(match[1]) : 0;
    });
  }

  layers._savedLayerOpacity = {
    global: Number(layers.globalLayer.attr("opacity")) || 0,
    albums,
    center,
  };
}

/** Keep center hole album logo visible while section points are shown. */
function showDrilldownCenterLogo(song) {
  const layers = appState.overviewLayers;
  if (!layers?.centerImagesG) return;

  const albumName = getAlbumKey(song);
  const { centerX, centerY } = layers;
  layers.centerImagesG.selectAll(".center-logo-wrap").each(function () {
    const wrap = d3.select(this);
    const layerKey =
      wrap.attr("data-layer-key") === "global"
        ? "global"
        : wrap.attr("data-album");
    const visible = layerKey !== "global" && layerKey === albumName;
    wrap
      .attr("opacity", visible ? 1 : 0)
      .attr("transform", `rotate(0 ${centerX} ${centerY})`);
  });

  document.querySelector(".overview-viz-frame")?.classList.remove("show-global-era");
}

function updateStageChrome(song, sections) {
  const label = d3.select("#scroll-stage-label");
  const hint = d3.select(".section-hint");
  const color = appState.albumColorScale(getAlbumKey(song));

  label.html(
    `<span class="stage-label-eyebrow">Song sections</span>` +
      `<span class="stage-label-title" style="color:${color}">${song.song_title}</span>`
  );

  hint.html(
    `${sections.length} sections · double-click wheel or press <kbd>Esc</kbd> to return · ` +
      `click a point for lyrics`
  );

  document.querySelector(".overview-viz-wrap")?.classList.add("is-section-drilldown");
}

function restoreStageChrome() {
  d3.select(".section-hint").text(
    "Hover a star for details. Click to pin · double-click a song for sections."
  );
  document.querySelector(".overview-viz-wrap")?.classList.remove("is-section-drilldown");
}

function renderSectionTypeLegend(sections) {
  const host = d3.select("#section-type-legend");
  host.selectAll("*").remove();

  const types = [
    ...new Set(
      sections.map((s) => s.section_type_label || s.section_type || "Section")
    ),
  ].sort();

  const wrap = host
    .append("div")
    .attr("class", "section-type-legend-inner");

  wrap.append("span").attr("class", "section-type-legend-title").text("Section");

  types.forEach((type) => {
    const item = wrap.append("button").attr("type", "button").attr("class", "section-type-chip");
    item
      .append("span")
      .attr("class", "section-type-swatch")
      .style("background", sectionTypeColor(appState.sectionTypeColorScale, {
        section_type_label: type,
      }));
    item.append("span").text(type);
  });

  host.attr("hidden", null);
}

function hideSectionTypeLegend() {
  const host = d3.select("#section-type-legend");
  host.selectAll("*").remove();
  host.attr("hidden", "");
}

export function isSongDrilldownActive() {
  return appState.drilldownSong != null;
}

export function enterSongDrilldown(song) {
  const layers = appState.overviewLayers;
  if (!layers?.svg || !song) return;

  const sections = getSongSectionsForDrilldown(
    song,
    appState.sectionsBySong,
    appState.sectionWheelBySong
  );
  if (!sections.length) return;

  exitSongDrilldown({ silent: true });

  saveLayerOpacitySnapshot();
  setMainLayersHidden(true);
  showDrilldownCenterLogo(song);

  appState.drilldownSong = song;

  const { centerX, centerY, innerRadius, outerRadius, wheelRadius } = layers;

  const { sizeScale } = createWheelScales(wheelRadius, sections, [5, 15]);

  const drillG = layers.svg
    .append("g")
    .attr("class", "song-drilldown-layer")
    .attr("opacity", 0);

  drawSectionPoints(drillG, sections, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    parentSong: song,
    colorForSection: (sec) =>
      sectionTypeColor(appState.sectionTypeColorScale, sec),
    onClick: (section, parent) => updateSectionDetailPanel(section, parent),
  });

  drillG
    .transition()
    .duration(420)
    .ease(d3.easeCubicOut)
    .attr("opacity", 1);

  layers.drilldownG = drillG;
  updateStageChrome(song, sections);
  renderSectionTypeLegend(sections);
  updateDetailPanel(song);

  const frame = document.querySelector(".overview-viz-frame");
  frame?.classList.add("is-drilldown-active");
}

export function exitSongDrilldown(options = {}) {
  const { silent = false } = options;
  const layers = appState.overviewLayers;
  if (!layers || !appState.drilldownSong) return;

  const finish = () => {
    appState.drilldownSong = null;
    layers.drilldownG = null;
    setMainLayersHidden(false);
    hideSectionTypeLegend();
    restoreStageChrome();
    document.querySelector(".overview-viz-frame")?.classList.remove("is-drilldown-active");
    if (!silent) {
      d3.select("#tooltip").attr("hidden", "");
    }
  };

  const drillG = layers.drilldownG;
  if (!drillG || drillG.empty()) {
    finish();
    return;
  }

  drillG
    .transition()
    .duration(320)
    .ease(d3.easeCubicIn)
    .attr("opacity", 0)
    .on("end", () => {
      drillG.remove();
      finish();
    });
}

export function initSongDrilldown() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isSongDrilldownActive()) {
      exitSongDrilldown();
    }
  });

  d3.select("#overview-viz").on("dblclick.drilldown", (event) => {
    if (!isSongDrilldownActive()) return;
    if (event.target.closest(".section-point, .song-point")) return;
    exitSongDrilldown();
  });
}

export function handleSongDblClick(song) {
  if (isSongDrilldownActive() && appState.drilldownSong?.song_id === song.song_id) {
    exitSongDrilldown();
    return;
  }
  enterSongDrilldown(song);
}
