import * as d3 from "d3";
import { groupSongsByAlbum } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { updateDetailPanel } from "../ui/panel.js";
import { refreshOverviewHighlight } from "./highlight.js";
import { drawAlbumPaths, drawSongPoints } from "./layers.js";
import { getOverviewVizLayout } from "../config/constants.js";
import {
  createWheelScales,
  drawWheelBackground,
  ensureWheelDefs,
} from "./wheel.js";

export function drawGalaxyOverview(data) {
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
    .attr("height", height);

  const { sizeScale, innerRadius, outerRadius } = createWheelScales(wheelRadius);
  const { clipId, glowId, pathGlowId } = ensureWheelDefs(svg, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    idPrefix,
  });

  const grouped = groupSongsByAlbum(data);
  const defaultOpacity = 0.75;

  drawWheelBackground(svg, {
    centerX,
    centerY,
    wheelRadius,
    idPrefix,
  });

  const pathOpacity = 0.28;

  const pathsG = drawAlbumPaths(svg, grouped, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    clipId,
    pathGlowId,
    opacity: pathOpacity,
    highlightAlbum: appState.selectedAlbumHighlight,
    routeAroundHole: true,
  });

  const pointsG = drawSongPoints(svg, data, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    glowId,
    defaultOpacity,
    highlightAlbum: appState.selectedAlbumHighlight,
    onClick: updateDetailPanel,
  });
  pointsG.raise();

  appState.overviewLayers = {
    svg,
    pathsG,
    pointsG,
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

  refreshOverviewHighlight();
}
