import * as d3 from "d3";
import {
  ANGLE_STEP_DEG,
  INNER_HOLE_RATIO,
  INTENSITY_RINGS,
  JOY_ANGLE_DEG,
  PLUTCHIK_ORDER,
} from "../config/constants.js";
import { appState } from "../state/app-state.js";

export function emotionAngleDeg(emotion) {
  const i = PLUTCHIK_ORDER.indexOf(emotion);
  return i >= 0 ? JOY_ANGLE_DEG + i * ANGLE_STEP_DEG : 0;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function getInnerRadius(wheelRadius) {
  return wheelRadius * INNER_HOLE_RATIO;
}

export function ringRadiusAtLevel(level, innerRadius, outerRadius) {
  return innerRadius + level * (outerRadius - innerRadius);
}

/** Emotion intensity in data: 0 = inner hole edge, 1 = outer wheel edge. */
export function dataIntensity(d) {
  const r =
    d.radius ??
    d.primary_score ??
    Math.hypot(d.x ?? 0, d.y ?? 0);
  return Math.min(1, Math.max(0, Number(r) || 0));
}

export function intensityToPixelRadius(intensity, innerRadius, outerRadius) {
  const t = Math.min(1, Math.max(0, Number(intensity) || 0));
  return innerRadius + t * (outerRadius - innerRadius);
}

/**
 * Map song (x, y) as polar offset: direction from (x,y), radius from intensity.
 * Avoids per-axis scaling that pushes diagonal points past the outer ring.
 */
export function projectSongPosition(d, centerX, centerY, innerRadius, outerRadius) {
  const intensity = dataIntensity(d);
  const theta = Math.atan2(d.y ?? 0, d.x ?? 0);
  const pixelR = innerRadius + intensity * (outerRadius - innerRadius);
  return {
    cx: centerX + pixelR * Math.cos(theta),
    cy: centerY + pixelR * Math.sin(theta),
  };
}

export function projectX(d, centerX, innerRadius, outerRadius) {
  return projectSongPosition(d, centerX, 0, innerRadius, outerRadius).cx;
}

export function projectY(d, centerY, innerRadius, outerRadius) {
  return projectSongPosition(d, 0, centerY, innerRadius, outerRadius).cy;
}

export function createWheelScales(wheelRadius, songs = appState.allSongs, sizeRange = [6, 17]) {
  const innerRadius = getInnerRadius(wheelRadius);
  const outerRadius = wheelRadius;
  const sizeScale = d3
    .scaleSqrt()
    .domain(d3.extent(songs, (d) => d.primary_score ?? 0))
    .range(sizeRange)
    .clamp(true);
  return { sizeScale, wheelRadius, innerRadius, outerRadius };
}

/** Square diamond (rotated 45°) centered at (cx, cy). */
export function diamondPath(cx, cy, half) {
  const h = Math.max(1, half);
  return `M ${cx} ${cy - h} L ${cx + h} ${cy} L ${cx} ${cy + h} L ${cx - h} ${cy} Z`;
}

/** 4-point sparkle star path centered at (cx, cy). */
export function starPath(cx, cy, outerR, innerRatio = 0.32, points = 4) {
  const innerR = outerR * innerRatio;
  const step = Math.PI / points;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + i * step;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Tabler icon-tabler-sparkle (24×24); center (12,12), outer extent ≈ 9 from center. */
export const TABLER_SPARKLE_D =
  "M21 12c-6.597 0 -9 2.403 -9 9c0 -6.597 -2.403 -9 -9 -9c6.597 0 9 -2.403 9 -9c0 6.597 2.403 9 9 9";

const TABLER_SPARKLE_CENTER = 12;
const TABLER_SPARKLE_OUTER_R = 9;

/** Parent g is translated to song position; sparkle centered at origin with radius outerR. */
export function sparkleTransform(outerR) {
  const s = Math.max(outerR, 1) / TABLER_SPARKLE_OUTER_R;
  return `scale(${s}) translate(${-TABLER_SPARKLE_CENTER},${-TABLER_SPARKLE_CENTER})`;
}

export const STAR_GLOW_OPACITY_DEFAULT = 0.24;
export const STAR_GLOW_OPACITY_HOVER = 0.48;
export const STAR_GLOW_SCALE_DEFAULT = 1.22;
export const STAR_GLOW_SCALE_HOVER = 1.32;

const DARK_STROKE_LUMINANCE = 0.22;
export const SPARKLE_MUTED_STROKE = "rgba(176, 170, 162, 0.92)";

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

export function isDarkAlbumColor(color) {
  const rgb = parseHexColor(color);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < DARK_STROKE_LUMINANCE;
}

/** Muted grey outline on dark album fills so sparkle icons stay visible on the wheel. */
export function applySparkleShapeStroke(sel, color) {
  const dark = isDarkAlbumColor(color);
  sel.attr("stroke", dark ? SPARKLE_MUTED_STROKE : "none").attr(
    "stroke-width",
    dark ? 0.8 : null
  );
  if (dark) sel.attr("stroke-linejoin", "round");
  else sel.attr("stroke-linejoin", null);
}

/** Even-odd donut path (outer circle minus inner hole). */
export function donutPathD(centerX, centerY, outerRadius, innerRadius) {
  const outer = outerRadius;
  const inner = Math.max(0, innerRadius);
  return [
    `M ${centerX} ${centerY - outer}`,
    `a ${outer} ${outer} 0 1 1 0 ${outer * 2}`,
    `a ${outer} ${outer} 0 1 1 0 ${-outer * 2}`,
    `M ${centerX} ${centerY - inner}`,
    `a ${inner} ${inner} 0 1 0 0 ${inner * 2}`,
    `a ${inner} ${inner} 0 1 0 0 ${-inner * 2}`,
    "Z",
  ].join(" ");
}

function ensureVinylShadowFilter(defs, options) {
  const { centerX, centerY, outerRadius, idPrefix } = options;
  const shadowId = `${idPrefix}-vinyl-shadow`;
  if (!defs.select(`#${shadowId}`).empty()) return shadowId;

  const pad = 20;
  const size = (outerRadius + pad) * 2;
  const filter = defs
    .append("filter")
    .attr("id", shadowId)
    .attr("filterUnits", "userSpaceOnUse")
    .attr("x", centerX - outerRadius - pad)
    .attr("y", centerY - outerRadius - pad)
    .attr("width", size)
    .attr("height", size);

  filter
    .append("feGaussianBlur")
    .attr("in", "SourceAlpha")
    .attr("stdDeviation", 5)
    .attr("result", "blur");
  filter
    .append("feOffset")
    .attr("in", "blur")
    .attr("dx", 0)
    .attr("dy", 5)
    .attr("result", "offsetBlur");
  filter
    .append("feFlood")
    .attr("flood-color", "#1a1510")
    .attr("flood-opacity", 0.42)
    .attr("result", "shadowColor");
  filter
    .append("feComposite")
    .attr("in", "shadowColor")
    .attr("in2", "offsetBlur")
    .attr("operator", "in")
    .attr("result", "shadow");
  const merge = filter.append("feMerge");
  merge.append("feMergeNode").attr("in", "shadow");
  merge.append("feMergeNode").attr("in", "SourceGraphic");

  return shadowId;
}

function ensureVinylDefs(defs, options) {
  const { centerX, centerY, outerRadius, idPrefix } = options;
  const fillId = `${idPrefix}-vinyl-fill`;
  const speckleId = `${idPrefix}-vinyl-speckle`;
  const sheenId = `${idPrefix}-vinyl-sheen`;
  const grainId = `${idPrefix}-vinyl-grain`;

  if (defs.select(`#${fillId}`).empty()) {
    const grad = defs
      .append("radialGradient")
      .attr("id", fillId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", outerRadius);

    grad
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#3a3a40");
    grad
      .append("stop")
      .attr("offset", "42%")
      .attr("stop-color", "#2c2c32");
    grad
      .append("stop")
      .attr("offset", "78%")
      .attr("stop-color", "#222228");
    grad
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#323238");
  }

  if (defs.select(`#${sheenId}`).empty()) {
    const sheen = defs
      .append("linearGradient")
      .attr("id", sheenId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", centerX - outerRadius * 0.65)
      .attr("y1", centerY - outerRadius * 0.65)
      .attr("x2", centerX + outerRadius * 0.55)
      .attr("y2", centerY + outerRadius * 0.55);

    sheen.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255,255,255,0.22)");
    sheen.append("stop").attr("offset", "38%").attr("stop-color", "rgba(255,255,255,0.04)");
    sheen.append("stop").attr("offset", "62%").attr("stop-color", "rgba(0,0,0,0.12)");
    sheen.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255,255,255,0.1)");
  }

  if (defs.select(`#${grainId}`).empty()) {
    const tile = 6;
    const pattern = defs
      .append("pattern")
      .attr("id", grainId)
      .attr("width", tile)
      .attr("height", tile)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", `rotate(-12 ${tile / 2} ${tile / 2})`);

    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", tile / 2)
      .attr("x2", tile)
      .attr("y2", tile / 2)
      .attr("stroke", "rgba(255, 255, 255, 0.07)")
      .attr("stroke-width", 0.35);
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 1)
      .attr("x2", tile)
      .attr("y2", 1)
      .attr("stroke", "rgba(0, 0, 0, 0.06)")
      .attr("stroke-width", 0.25);
  }

  if (defs.select(`#${speckleId}`).empty()) {
    const tile = 14;
    const pattern = defs
      .append("pattern")
      .attr("id", speckleId)
      .attr("width", tile)
      .attr("height", tile)
      .attr("patternUnits", "userSpaceOnUse");

    for (let i = 0; i < 18; i += 1) {
      const cx = ((i * 5.17 + 1.2) % (tile - 1)) + 0.5;
      const cy = ((i * 8.31 + 2.4) % (tile - 1)) + 0.5;
      const r = 0.1 + (i % 3) * 0.06;
      const a = 0.14 + (i % 4) * 0.06;
      pattern
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r)
        .attr("fill", `rgba(255, 255, 255, ${a.toFixed(2)})`);
    }
  }

  return { fillId, speckleId, sheenId, grainId };
}

export function ensureWheelDefs(svg, options) {
  const { centerX, centerY, innerRadius, outerRadius, idPrefix = "wheel" } =
    options;
  let defs = svg.select("defs");
  if (defs.empty()) defs = svg.append("defs");

  const clipId = `${idPrefix}-annulus-clip`;
  const glowId = `${idPrefix}-star-glow`;
  const pathGlowId = `${idPrefix}-path-glow`;

  const clip = defs.select(`#${clipId}`);
  if (clip.empty()) {
    const outer = outerRadius + 2;
    const inner = Math.max(0, innerRadius - 1);
    const donutD = donutPathD(centerX, centerY, outer, inner);

    defs
      .append("clipPath")
      .attr("id", clipId)
      .attr("clipPathUnits", "userSpaceOnUse")
      .append("path")
      .attr("fill-rule", "evenodd")
      .attr("d", donutD);
  }

  const { fillId, speckleId, sheenId, grainId } = ensureVinylDefs(defs, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    idPrefix,
  });

  const vinylShadowId = ensureVinylShadowFilter(defs, {
    centerX,
    centerY,
    outerRadius,
    idPrefix,
  });

  if (defs.select(`#${glowId}`).empty()) {
    const filter = defs
      .append("filter")
      .attr("id", glowId)
      .attr("x", "-120%")
      .attr("y", "-120%")
      .attr("width", "340%")
      .attr("height", "340%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "2.2")
      .attr("result", "blur");
    filter
      .append("feGaussianBlur")
      .attr("in", "blur")
      .attr("stdDeviation", "3.2")
      .attr("result", "wideBlur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "wideBlur");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
  }

  if (defs.select(`#${pathGlowId}`).empty()) {
    const pathFilter = defs
      .append("filter")
      .attr("id", pathGlowId)
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    pathFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3.5")
      .attr("result", "blur");
    pathFilter.append("feMerge").append("feMergeNode").attr("in", "blur");
  }

  return {
    clipId,
    glowId,
    pathGlowId,
    vinylFillId: fillId,
    vinylSpeckleId: speckleId,
    vinylSheenId: sheenId,
    vinylGrainId: grainId,
    vinylShadowId,
  };
}

export function drawWheelBackground(svg, options) {
  const {
    centerX,
    centerY,
    wheelRadius,
    showLabels = true,
    labelClass = "wheel-label",
    idPrefix = "wheel",
  } = options;

  const innerRadius = getInnerRadius(wheelRadius);
  const outerRadius = wheelRadius;
  const {
    clipId,
    vinylFillId,
    vinylSpeckleId,
    vinylSheenId,
    vinylGrainId,
    vinylShadowId,
  } = ensureWheelDefs(svg, {
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    idPrefix,
  });

  const g = svg.append("g").attr("class", "wheel-background");
  const donutD = donutPathD(centerX, centerY, outerRadius, innerRadius);

  g.append("path")
    .attr("class", "wheel-vinyl-shadow")
    .attr("fill-rule", "evenodd")
    .attr("d", donutD)
    .attr("fill", "#2a2a30")
    .attr("filter", `url(#${vinylShadowId})`);

  const vinylG = g
    .append("g")
    .attr("class", "wheel-vinyl")
    .attr("clip-path", `url(#${clipId})`);

  vinylG
    .append("path")
    .attr("class", "wheel-vinyl-surface")
    .attr("fill-rule", "evenodd")
    .attr("d", donutD)
    .attr("fill", `url(#${vinylFillId})`);

  vinylG
    .append("path")
    .attr("class", "wheel-vinyl-grain")
    .attr("fill-rule", "evenodd")
    .attr("d", donutD)
    .attr("fill", `url(#${vinylGrainId})`);

  vinylG
    .append("path")
    .attr("class", "wheel-vinyl-sheen")
    .attr("fill-rule", "evenodd")
    .attr("d", donutD)
    .attr("fill", `url(#${vinylSheenId})`);

  vinylG
    .append("path")
    .attr("class", "wheel-vinyl-speckle")
    .attr("fill-rule", "evenodd")
    .attr("d", donutD)
    .attr("fill", `url(#${vinylSpeckleId})`);

  const grooveCount = 36;
  for (let i = 1; i < grooveCount; i += 1) {
    const r =
      innerRadius + (i / grooveCount) * (outerRadius - innerRadius);
    const wave = 0.5 + 0.5 * Math.sin(i * 1.15);
    vinylG
      .append("circle")
      .attr("class", "wheel-vinyl-groove")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", r)
      .attr("stroke-opacity", 0.04 + wave * 0.07);
  }

  vinylG
    .append("circle")
    .attr("class", "wheel-vinyl-rim wheel-vinyl-rim--outer")
    .attr("cx", centerX)
    .attr("cy", centerY)
    .attr("r", outerRadius);

  vinylG
    .append("circle")
    .attr("class", "wheel-vinyl-rim wheel-vinyl-rim--inner")
    .attr("cx", centerX)
    .attr("cy", centerY)
    .attr("r", innerRadius);

  INTENSITY_RINGS.forEach((level) => {
    const r = ringRadiusAtLevel(level, innerRadius, outerRadius);
    g.append("circle")
      .attr("class", "wheel-ring")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", r);
  });

  PLUTCHIK_ORDER.forEach((emotion) => {
    const angle = degToRad(emotionAngleDeg(emotion));
    const x1 = centerX + innerRadius * Math.cos(angle);
    const y1 = centerY + innerRadius * Math.sin(angle);
    const x2 = centerX + outerRadius * Math.cos(angle);
    const y2 = centerY + outerRadius * Math.sin(angle);
    g.append("line")
      .attr("class", "wheel-axis")
      .attr("x1", x1)
      .attr("y1", y1)
      .attr("x2", x2)
      .attr("y2", y2);
  });

  g.append("circle")
    .attr("class", "wheel-core-void")
    .attr("cx", centerX)
    .attr("cy", centerY)
    .attr("r", innerRadius);

  if (showLabels) {
    // Just outside the outer rim (not 1.14× — that pushed labels too far from axes)
    const labelPad = Math.max(6, outerRadius * 0.058);
    const labelR = outerRadius + labelPad;
    PLUTCHIK_ORDER.forEach((emotion) => {
      const angle = degToRad(emotionAngleDeg(emotion));
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const lx = centerX + labelR * cos;
      const ly = centerY + labelR * sin;

      let textAnchor = "middle";
      let dx = 0;
      let dy = 0;
      const nudge = Math.max(2, labelPad * 0.45);
      if (cos > 0.4) {
        textAnchor = "start";
        dx = nudge;
      } else if (cos < -0.4) {
        textAnchor = "end";
        dx = -nudge;
      }
      if (sin < -0.4) dy = -nudge * 0.6;
      else if (sin > 0.4) dy = nudge * 0.6;

      g.append("text")
        .attr("class", labelClass)
        .attr("x", lx)
        .attr("y", ly)
        .attr("dx", dx)
        .attr("dy", dy)
        .attr("text-anchor", textAnchor)
        .attr("dominant-baseline", "middle")
        .text(emotion);
    });
  }

  return { g, innerRadius, outerRadius, clipId };
}
