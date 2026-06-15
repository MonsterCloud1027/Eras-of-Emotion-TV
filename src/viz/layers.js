import * as d3 from "d3";
import { getAlbumKey, sortSongsByAngleClockwise } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { formatNum } from "../utils/format.js";
import { updateDetailPanel } from "../ui/panel.js";
import { clearSongHover, setSongHover } from "./highlight.js";
import {
  dataIntensity,
  diamondPath,
  projectSongPosition,
  sparkleTransform,
  TABLER_SPARKLE_D,
  STAR_GLOW_OPACITY_DEFAULT,
  STAR_GLOW_SCALE_DEFAULT,
  applySparkleShapeStroke,
  isDarkAlbumColor,
} from "./wheel.js";

const DARK_STROKE_LUMINANCE = 0.22;
const DARK_PATH_OUTLINE = "rgba(236, 232, 224, 0.72)";

function parseHexColor(color) {
  if (!color || typeof color !== "string") return null;
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function brightenForFluorescent(color, mix = 0.55) {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  return `rgb(${rgb
    .map((v) => Math.min(255, Math.round(v + (255 - v) * mix)))
    .join(",")})`;
}

function pixelCoord(d, centerX, centerY, innerRadius, outerRadius) {
  const { cx, cy } = projectSongPosition(
    d,
    centerX,
    centerY,
    innerRadius,
    outerRadius
  );
  return [cx, cy];
}

function segmentCrossesHole(x1, y1, x2, y2, cx, cy, innerRadius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) {
    return Math.hypot(x1 - cx, y1 - cy) < innerRadius;
  }
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) < innerRadius * 0.98;
}

/** Clockwise angle span from θ1 to θ2 (SVG wheel direction). */
function clockwiseAngleDelta(theta1, theta2) {
  let delta = theta2 - theta1;
  if (delta <= 0) delta += 2 * Math.PI;
  return delta;
}

function makePolarWaypoint(intensity, theta) {
  const r = Math.min(1, Math.max(0, intensity));
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
    radius: r,
    __polar: true,
  };
}

/** Arc in data polar space: angle sweeps clockwise, radius linearly interpolated. */
function polarArcWaypoints(a, b, steps) {
  const theta1 = Math.atan2(a.y ?? 0, a.x ?? 0);
  const theta2 = Math.atan2(b.y ?? 0, b.x ?? 0);
  const r1 = dataIntensity(a);
  const r2 = dataIntensity(b);
  const delta = clockwiseAngleDelta(theta1, theta2);
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    pts.push(
      makePolarWaypoint(r1 + (r2 - r1) * t, theta1 + delta * t)
    );
  }
  return pts;
}

/** When a chord crosses the center hole, route along the inner circle instead. */
function innerHoleArcWaypoints(
  a,
  b,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  steps
) {
  const [x1, y1] = pixelCoord(a, centerX, centerY, innerRadius, outerRadius);
  const [x2, y2] = pixelCoord(b, centerX, centerY, innerRadius, outerRadius);
  const theta1 = Math.atan2(y1 - centerY, x1 - centerX);
  const theta2 = Math.atan2(y2 - centerY, x2 - centerX);
  const delta = clockwiseAngleDelta(theta1, theta2);
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const theta = theta1 + delta * t;
    pts.push({
      __arc: true,
      px: centerX + innerRadius * Math.cos(theta),
      py: centerY + innerRadius * Math.sin(theta),
    });
  }
  return pts;
}

/**
 * Closed ring along circular arcs in polar space (no Cartesian spline bulge).
 */
function buildAlbumRingPathData(
  songs,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  routeAroundHole
) {
  const sorted = sortSongsByAngleClockwise(songs);
  const n = sorted.length;
  if (n < 2) return sorted;

  const expanded = [];

  for (let i = 0; i < n; i++) {
    const a = sorted[i];
    const b = sorted[(i + 1) % n];
    const theta1 = Math.atan2(a.y ?? 0, a.x ?? 0);
    const theta2 = Math.atan2(b.y ?? 0, b.x ?? 0);
    const delta = clockwiseAngleDelta(theta1, theta2);
    const steps = Math.max(8, Math.ceil((delta / (2 * Math.PI)) * 40));

    const [x1, y1] = pixelCoord(a, centerX, centerY, innerRadius, outerRadius);
    const [x2, y2] = pixelCoord(b, centerX, centerY, innerRadius, outerRadius);

    const segmentPts =
      routeAroundHole &&
      innerRadius > 0 &&
      segmentCrossesHole(x1, y1, x2, y2, centerX, centerY, innerRadius)
        ? innerHoleArcWaypoints(
            a,
            b,
            centerX,
            centerY,
            innerRadius,
            outerRadius,
            steps
          )
        : polarArcWaypoints(a, b, steps);

    if (i === 0) expanded.push(...segmentPts);
    else expanded.push(...segmentPts.slice(1));
  }

  return expanded;
}

function pathXY(
  d,
  centerX,
  centerY,
  innerRadius,
  outerRadius
) {
  if (d.__arc) return [d.px, d.py];
  const { cx, cy } = projectSongPosition(
    d,
    centerX,
    centerY,
    innerRadius,
    outerRadius
  );
  return [cx, cy];
}

function radialSegmentFromCenter(
  song,
  centerX,
  centerY,
  innerRadius,
  outerRadius
) {
  const [x2, y2] = pathXY(song, centerX, centerY, innerRadius, outerRadius);
  return [
    [centerX, centerY],
    [x2, y2],
  ];
}

export function drawAlbumPaths(parentSel, groupedData, options) {
  const {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    clipId = null,
    pathClass = "constellation-path",
    pathGlowId = null,
    opacity = 0.42,
    strokeWidth = 2,
    glowStrokeWidth = 5,
    highlightAlbum = null,
  } = options;

  const g = parentSel.append("g").attr("class", "constellation-paths");
  if (clipId) g.attr("clip-path", `url(#${clipId})`);

  const radialLine = d3
    .line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(d3.curveLinear);

  for (const [album, songs] of groupedData) {
    if (songs.length === 0) continue;
    const color = appState.albumColorScale(album);
    const dimmed =
      highlightAlbum != null && highlightAlbum !== album ? " dimmed" : "";

    const albumG = g
      .append("g")
      .attr("class", "constellation-album")
      .attr("data-album", album);

    const darkStroke = isDarkAlbumColor(color);
    const glowStroke = darkStroke ? DARK_PATH_OUTLINE : color;

    const appendRadialPath = (className, stroke, width, pathOpacity) => {
      albumG
        .selectAll(`path.${className.split(" ")[0]}`)
        .data(songs, (d) => d.song_id)
        .join("path")
        .attr("class", className)
        .attr("data-album", album)
        .attr("d", (d) =>
          radialLine(
            radialSegmentFromCenter(
              d,
              centerX,
              centerY,
              innerRadius,
              outerRadius
            )
          )
        )
        .attr("fill", "none")
        .attr("stroke", stroke)
        .attr("stroke-width", width)
        .attr("stroke-linecap", "round")
        .attr("opacity", pathOpacity);
    };

    if (darkStroke) {
      appendRadialPath(
        "constellation-path-outline" + dimmed,
        DARK_PATH_OUTLINE,
        strokeWidth + 2.5,
        opacity
      );
    }

    appendRadialPath(
      "constellation-path-glow" + dimmed,
      glowStroke,
      glowStrokeWidth,
      0
    );
    appendRadialPath(pathClass + dimmed, color, strokeWidth, opacity);
  }

  return g;
}

export function renderStarShapes(
  node,
  d,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  sizeScale,
  glowId,
  hoverScale = 1,
  showGlow = false,
  fillColor = null
) {
  const { cx, cy } = projectSongPosition(
    d,
    centerX,
    centerY,
    innerRadius,
    outerRadius
  );
  const r = sizeScale(d.primary_score ?? 0);
  const color = fillColor ?? appState.albumColorScale(getAlbumKey(d));
  const g = d3.select(node);

  g.attr("transform", `translate(${cx},${cy}) scale(${hoverScale})`);

  let glow = g.select(".song-star-glow");
  if (glow.empty()) {
    glow = g.append("path").attr("class", "song-star-glow");
  }
  glow
    .attr("d", TABLER_SPARKLE_D)
    .attr("transform", sparkleTransform(r * STAR_GLOW_SCALE_DEFAULT))
    .attr("fill", color)
    .attr("opacity", STAR_GLOW_OPACITY_DEFAULT)
    .attr("filter", glowId ? `url(#${glowId})` : null);

  let shape = g.select(".song-star-shape");
  if (shape.empty()) {
    shape = g.append("path").attr("class", "song-star-shape");
  }
  shape
    .attr("d", TABLER_SPARKLE_D)
    .attr("transform", sparkleTransform(r))
    .attr("fill", color);
  applySparkleShapeStroke(shape, color);

  let core = g.select(".song-star-core");
  if (core.empty()) {
    core = g.append("path").attr("class", "song-star-core");
  }
  core
    .attr("d", TABLER_SPARKLE_D)
    .attr("transform", sparkleTransform(Math.max(1.2, r * 0.3)))
    .attr("fill", brightenForFluorescent(color, 0.32))
    .attr("opacity", 0.72)
    .attr("stroke", "none");
}

function renderSectionDiamond(
  node,
  d,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  sizeScale,
  fillColor
) {
  const { cx, cy } = projectSongPosition(
    d,
    centerX,
    centerY,
    innerRadius,
    outerRadius
  );
  const half = sizeScale(d.primary_score ?? 0);
  const g = d3.select(node);

  g.attr("transform", `translate(${cx},${cy})`);

  let glow = g.select(".section-diamond-glow");
  if (glow.empty()) {
    glow = g.append("path").attr("class", "section-diamond-glow");
  }
  glow
    .attr("d", diamondPath(0, 0, half * 1.35))
    .attr("fill", fillColor)
    .attr("opacity", 0.28);

  let shape = g.select(".section-diamond-shape");
  if (shape.empty()) {
    shape = g.append("path").attr("class", "section-diamond-shape");
  }
  shape
    .attr("d", diamondPath(0, 0, half))
    .attr("fill", fillColor)
    .attr("stroke", "rgba(255, 253, 249, 0.9)")
    .attr("stroke-width", 0.85)
    .attr("stroke-linejoin", "round");
}

export function drawSongPoints(parentSel, data, options) {
  const {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    glowId = null,
    pointClass = "song-point",
    defaultOpacity = 0.75,
    highlightAlbum = null,
    onHover,
    onClick,
    onDblClick,
    interactive = true,
  } = options;

  const g = parentSel.append("g").attr("class", "song-points");
  const tooltip = d3.select("#tooltip");

  const stars = g
    .selectAll("g.song-point")
    .data(data, (d) => d.song_id)
    .join("g")
    .attr("class", (d) => {
      const album = getAlbumKey(d);
      const dim =
        highlightAlbum != null && highlightAlbum !== album ? " dimmed" : "";
      return pointClass + dim;
    })
    .attr("data-album", getAlbumKey)
    .attr("data-song-id", (d) => d.song_id)
    .attr("opacity", defaultOpacity)
    .each(function (d) {
      renderStarShapes(
        this,
        d,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        sizeScale,
        glowId,
        1,
        false
      );
    });

  if (!interactive) {
    g.raise();
    return g;
  }

  stars
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      setSongHover(d);

      tooltip
        .attr("hidden", null)
        .style("left", `${event.clientX + 12}px`)
        .style("top", `${event.clientY + 12}px`)
        .html(
          `<strong>${d.song_title}</strong>` +
            `Album: ${getAlbumKey(d)}<br/>` +
            `Primary: ${d.primary_emotion} (${formatNum(d.primary_score)})<br/>`
            
        );

      if (onHover) onHover(d);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", `${event.clientX + 12}px`)
        .style("top", `${event.clientY + 12}px`);
    })
    .on("mouseleave", function () {
      clearSongHover();
      tooltip.attr("hidden", "");
      if (onHover) onHover(null);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      updateDetailPanel(d);
      if (onClick) onClick(d);
    })
    .on("dblclick", (event, d) => {
      event.stopPropagation();
      event.preventDefault();
      if (onDblClick) onDblClick(d);
    });

  g.raise();
  return g;
}

export function drawSectionPoints(parentSel, sections, options) {
  const {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    sizeScale,
    colorForSection,
    parentSong,
    defaultOpacity = 0.88,
    onClick,
  } = options;

  const g = parentSel.append("g").attr("class", "section-points");
  const tooltip = d3.select("#tooltip");

  const dots = g
    .selectAll("g.section-point")
    .data(sections, (d) => d.section_id)
    .join("g")
    .attr("class", "section-point")
    .attr("data-section-id", (d) => d.section_id)
    .attr("opacity", defaultOpacity)
    .each(function (d) {
      renderSectionDiamond(
        this,
        d,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        sizeScale,
        colorForSection(d)
      );
    });

  dots
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      const label = d.section_type_label || d.section_type || "Section";
      tooltip
        .attr("hidden", null)
        .style("left", `${event.clientX + 12}px`)
        .style("top", `${event.clientY + 12}px`)
        .html(
          `<strong>${label}</strong> · #${d.section_index_in_song ?? "?"}<br/>` +
            `Primary: ${d.primary_emotion} (${formatNum(d.primary_score)})<br/>` +
            (parentSong?.song_title
              ? `<span class="tooltip-sub">${parentSong.song_title}</span>`
              : "")
        );
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", `${event.clientX + 12}px`)
        .style("top", `${event.clientY + 12}px`);
    })
    .on("mouseleave", () => {
      tooltip.attr("hidden", "");
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      if (onClick) onClick(d, parentSong);
    });

  g.raise();
  return g;
}
