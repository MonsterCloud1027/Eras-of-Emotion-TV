import * as d3 from "d3";
import { getAlbumLogoUrl } from "../config/album-logos.js";
import { groupSongsByAlbum } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { updateLegendFromScroll } from "../ui/legend.js";
import { updateDetailPanel } from "../ui/panel.js";
import {
  applyAlbumHighlight,
  refreshOverviewHighlight,
  updateScrollFocusHighlight,
} from "./highlight.js";
import { handleSongDblClick } from "./song-drilldown.js";
import { drawAlbumPaths, drawSongPoints } from "./layers.js";
import {
  GLOBAL_CENTER_IMAGE,
  getOverviewVizLayout,
  wheelGlassDiameterPercent,
} from "../config/constants.js";
import {
  createWheelScales,
  drawWheelBackground,
  ensureWheelDefs,
  getInnerRadius,
} from "./wheel.js";

function drawCenterWheelImages(svg, options) {
  const { centerX, centerY, wheelRadius, albumOrder, idPrefix } = options;
  const innerRadius = getInnerRadius(wheelRadius);
  const imageSize = innerRadius * 1.75;
  const clipId = `${idPrefix}-logo-clip`;
  const ix = centerX - imageSize / 2;
  const iy = centerY - imageSize / 2;

  let defs = svg.select("defs");
  if (defs.empty()) defs = svg.append("defs");

  if (defs.select(`#${clipId}`).empty()) {
    defs
      .append("clipPath")
      .attr("id", clipId)
      .attr("clipPathUnits", "userSpaceOnUse")
      .append("circle")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", innerRadius * 0.92);
  }

  const centerG = svg
    .append("g")
    .attr("class", "center-wheel-images")
    .attr("clip-path", `url(#${clipId})`);

  centerG
    .append("image")
    .attr("class", "center-global-era")
    .attr("href", GLOBAL_CENTER_IMAGE)
    .attr("x", ix)
    .attr("y", iy)
    .attr("width", imageSize)
    .attr("height", imageSize)
    .attr("opacity", 1)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const entries = albumOrder
    .map((album) => ({ album, href: getAlbumLogoUrl(album) }))
    .filter((d) => d.href);

  centerG
    .selectAll("image.center-album-logo")
    .data(entries, (d) => d.album)
    .join("image")
    .attr("class", "center-album-logo")
    .attr("data-album", (d) => d.album)
    .attr("href", (d) => d.href)
    .attr("x", ix)
    .attr("y", iy)
    .attr("width", imageSize)
    .attr("height", imageSize)
    .attr("opacity", 0)
    .attr("preserveAspectRatio", "xMidYMid meet");

  return centerG;
}

/**
 * Sticky galaxy: fixed wheel axes; global + per-album content layers for scroll crossfade.
 */
export function drawScrollGalaxy(data) {
  const container = d3.select("#overview-viz");
  container.selectAll("*").remove();

  const { width, height, wheelRadius, centerX, centerY } = getOverviewVizLayout(
    container.node()?.clientWidth
  );
  const idPrefix = "overview";

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .attr("class", "galaxy-svg");

  const { sizeScale, innerRadius, outerRadius } = createWheelScales(wheelRadius);
  const { clipId, glowId, pathGlowId } = ensureWheelDefs(svg, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    idPrefix,
  });

  const grouped = groupSongsByAlbum(data);
  const pathOpacity = 0.42;
  const defaultOpacity = 0.75;
  const pathOpts = {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    clipId,
    pathGlowId,
    opacity: pathOpacity,
    routeAroundHole: true,
  };
  const pointOpts = {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    glowId,
    defaultOpacity,
    onClick: updateDetailPanel,
    onDblClick: handleSongDblClick,
  };

  drawWheelBackground(svg, {
    centerX,
    centerY,
    wheelRadius,
    idPrefix,
  });

  const albumOrder = [...grouped.keys()];
  const centerImagesG = drawCenterWheelImages(svg, {
    centerX,
    centerY,
    wheelRadius,
    albumOrder,
    idPrefix,
  });

  const globalLayer = svg
    .append("g")
    .attr("class", "viz-content-layer")
    .attr("data-layer", "global")
    .attr("opacity", 1);

  const globalPaths = drawAlbumPaths(globalLayer, grouped, {
    ...pathOpts,
    highlightAlbum: appState.selectedAlbumHighlight,
  });
  const globalPoints = drawSongPoints(globalLayer, data, {
    ...pointOpts,
    highlightAlbum: appState.selectedAlbumHighlight,
  });
  globalPoints.raise();

  const albumLayers = new Map();

  for (const [albumName, songs] of grouped) {
    const layer = svg
      .append("g")
      .attr("class", "viz-content-layer")
      .attr("data-layer", "album")
      .attr("data-album", albumName)
      .attr("opacity", 0)
      .style("pointer-events", "none");

    const albumGrouped = new Map([[albumName, songs]]);
    drawAlbumPaths(layer, albumGrouped, pathOpts);
    const pts = drawSongPoints(layer, songs, {
      ...pointOpts,
      highlightAlbum: null,
    });
    pts.raise();

    albumLayers.set(albumName, { layer, songs });
  }

  appState.overviewLayers = {
    svg,
    pathsG: globalPaths,
    pointsG: globalPoints,
    drilldownG: null,
    globalLayer,
    albumLayers,
    centerImagesG,
    albumOrder,
    wheelRadius,
    clipId,
    sizeScale,
    defaultOpacity,
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    pathGlowId,
    glowId,
    pathOpacity,
  };

  const frame = document.querySelector(".overview-viz-frame");
  if (frame) {
    frame.style.setProperty(
      "--wheel-glass-diameter",
      `${wheelGlassDiameterPercent()}%`
    );
  }

  refreshOverviewHighlight();
}

export function setContentLayerOpacities(opacityByKey) {
  const layers = appState.overviewLayers;
  if (!layers) return;

  const gOp = opacityByKey.global ?? 0;
  layers.globalLayer
    .attr("opacity", gOp)
    .style("pointer-events", gOp > 0.08 ? "all" : "none");

  for (const [album, { layer }] of layers.albumLayers) {
    const op = opacityByKey[album] ?? 0;
    layer
      .attr("opacity", op)
      .style("pointer-events", op > 0.08 ? "all" : "none");
  }

  const frame = document.querySelector(".overview-viz-frame");
  if (frame) {
    frame.classList.toggle("show-global-era", gOp > 0.08);
  }

  const vizWrap = document.querySelector(".overview-viz-wrap");
  if (vizWrap) {
    const isGlobalView = gOp > 0.08;
    const wasGlobalView = vizWrap.classList.contains("is-global-view");
    vizWrap.classList.toggle("is-global-view", isGlobalView);
    if (wasGlobalView && !isGlobalView && appState.selectedAlbumHighlight != null) {
      applyAlbumHighlight(null);
    }
  }

  if (layers.centerImagesG) {
    layers.centerImagesG
      .select("image.center-global-era")
      .attr("opacity", gOp);

    layers.centerImagesG.selectAll("image.center-album-logo").each(function () {
      const album = d3.select(this).attr("data-album");
      const op = opacityByKey[album] ?? 0;
      d3.select(this).attr("opacity", op);
    });
  }

  updateScrollFocusHighlight(opacityByKey, layers.albumOrder ?? []);
  updateLegendFromScroll(opacityByKey, layers.albumOrder ?? []);
}
