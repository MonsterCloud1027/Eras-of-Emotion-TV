import * as d3 from "d3";
import { getAlbumKey } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import {
  projectSongPosition,
  sparkleTransform,
  TABLER_SPARKLE_D,
  STAR_GLOW_OPACITY_DEFAULT,
  STAR_GLOW_OPACITY_HOVER,
  STAR_GLOW_SCALE_DEFAULT,
  STAR_GLOW_SCALE_HOVER,
  applySparkleShapeStroke,
} from "./wheel.js";

const PATH_OPACITY_DEFAULT = 0.28;
const PATH_OPACITY_ACTIVE = 0.52;
const PATH_OPACITY_DIM = 0.07;
const PATH_GLOW_OPACITY_ACTIVE = 0.25;
const PATH_GLOW_OPACITY_ALBUM_VIEW = 0.23;
const PATH_OPACITY_ALBUM_VIEW = 0.48;
const POINT_OPACITY_DEFAULT = 0.75;
const POINT_OPACITY_DIM = 0.1;

/**
 * Which album owns the scroll stage (null = global).
 * Uses dominant album during crossfades; avoids flicker to "Global" when both layers dip.
 */
export function pickScrollFocusAlbum(opacityByKey, albumOrder = []) {
  const globalOp = opacityByKey.global ?? 0;

  let bestAlbum = null;
  let bestOp = 0;
  for (const album of albumOrder) {
    const op = opacityByKey[album] ?? 0;
    if (op > bestOp) {
      bestOp = op;
      bestAlbum = album;
    }
  }

  if (globalOp > 0.12 && globalOp >= bestOp) {
    return null;
  }

  if (bestOp >= 0.08 && bestAlbum) {
    return bestAlbum;
  }

  return appState.scrollFocusAlbum ?? bestAlbum;
}

export function updateScrollFocusHighlight(opacityByKey, albumOrder) {
  const next = pickScrollFocusAlbum(opacityByKey, albumOrder);
  const globalOp = opacityByKey.global ?? 0;

  if (next != null || globalOp > 0.12) {
    appState.scrollFocusAlbum = next;
  }

  refreshOverviewHighlight();
}

/** Re-apply path + point styles from legend selection and/or song hover. */
export function refreshOverviewHighlight() {
  if (!appState.overviewLayers) return;

  const {
    svg,
    pathsG,
    pointsG,
    sizeScale,
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    pathGlowId,
    glowId,
    pathOpacity = PATH_OPACITY_DEFAULT,
  } = appState.overviewLayers;

  const hoverAlbum = appState.hoverAlbum;
  const legendAlbum = appState.selectedAlbumHighlight;
  const scrollFocusAlbum = appState.scrollFocusAlbum;
  const hoveredSongId = appState.hoveredSongId;
  const focusAlbum = hoverAlbum ?? legendAlbum ?? null;

  const pathRoot = svg ?? pathsG;
  const pointRoot = svg ?? pointsG;

  function layerTypeForNode(node) {
    const layer = node?.closest?.(".viz-content-layer");
    return layer?.getAttribute("data-layer") ?? "global";
  }

  pathRoot.selectAll("path.constellation-path-glow").each(function () {
    const album = d3.select(this).attr("data-album");
    const el = d3.select(this);
    const layerType = layerTypeForNode(this);
    const isHoverFocus = hoverAlbum && album === hoverAlbum;
    const isAlbumViewGlow =
      layerType === "album" &&
      scrollFocusAlbum != null &&
      album === scrollFocusAlbum;
    const isLegendFilterGlow =
      layerType === "global" &&
      legendAlbum != null &&
      album === legendAlbum &&
      scrollFocusAlbum == null;
    const showGlow = isHoverFocus || isAlbumViewGlow || isLegendFilterGlow;

    el.classed("dimmed", focusAlbum != null && album !== focusAlbum);
    el.attr(
      "opacity",
      showGlow
        ? isHoverFocus
          ? PATH_GLOW_OPACITY_ACTIVE
          : PATH_GLOW_OPACITY_ALBUM_VIEW
        : 0
    );
    el.attr("filter", showGlow && pathGlowId ? `url(#${pathGlowId})` : null);
  });

  pathRoot
    .selectAll("path.constellation-path, path.constellation-path-outline")
    .each(function () {
      const album = d3.select(this).attr("data-album");
      const el = d3.select(this);
      const layerType = layerTypeForNode(this);
      const dim = focusAlbum != null && album !== focusAlbum;
      const isHoverFocus = hoverAlbum && album === hoverAlbum;
      const isAlbumViewFocus =
        layerType === "album" &&
        scrollFocusAlbum != null &&
        album === scrollFocusAlbum;
      const isLegendFilterFocus =
        layerType === "global" &&
        legendAlbum != null &&
        album === legendAlbum &&
        scrollFocusAlbum == null;

      el.classed("dimmed", dim);
      if (isHoverFocus) {
        el.attr("opacity", PATH_OPACITY_ACTIVE);
      } else if (isAlbumViewFocus || isLegendFilterFocus) {
        el.attr("opacity", PATH_OPACITY_ALBUM_VIEW);
      } else if (dim) {
        el.attr("opacity", PATH_OPACITY_DIM);
      } else {
        el.attr("opacity", pathOpacity);
      }
    });

  pointRoot.selectAll("g.song-point").each(function (d) {
    const album = getAlbumKey(d);
    const el = d3.select(this);
    const layerType = layerTypeForNode(this);
    const dim = focusAlbum != null && album !== focusAlbum;
    const isHoveredStar =
      hoverAlbum && d.song_id === hoveredSongId && album === hoverAlbum;

    el.classed("dimmed", dim);
    el.attr("opacity", dim ? POINT_OPACITY_DIM : POINT_OPACITY_DEFAULT);

    if (!dim) {
      const { cx, cy } = projectSongPosition(
        d,
        centerX,
        centerY,
        innerRadius,
        outerRadius
      );
      const r = sizeScale(d.primary_score ?? 0);
      const scale = isHoveredStar ? 1.35 : 1;
      el.classed("is-hovered", isHoveredStar);
      el.attr("transform", `translate(${cx},${cy}) scale(${scale})`);

      const glow = el.select(".song-star-glow");
      if (!glow.empty()) {
        const glowScale = isHoveredStar
          ? STAR_GLOW_SCALE_HOVER
          : STAR_GLOW_SCALE_DEFAULT;
        glow
          .attr("d", TABLER_SPARKLE_D)
          .attr("transform", sparkleTransform(r * glowScale))
          .attr("fill", appState.albumColorScale(album))
          .attr(
            "opacity",
            isHoveredStar ? STAR_GLOW_OPACITY_HOVER : STAR_GLOW_OPACITY_DEFAULT
          )
          .attr("filter", glowId ? `url(#${glowId})` : null);
      }
      const shape = el.select(".song-star-shape");
      if (!shape.empty()) {
        const albumColor = appState.albumColorScale(album);
        shape
          .attr("d", TABLER_SPARKLE_D)
          .attr("transform", sparkleTransform(r))
          .attr("fill", albumColor);
        applySparkleShapeStroke(shape, albumColor);
      }
      const core = el.select(".song-star-core");
      if (!core.empty()) {
        core
          .attr("d", TABLER_SPARKLE_D)
          .attr("transform", sparkleTransform(Math.max(1.2, r * 0.3)));
      }
    } else {
      el.classed("is-hovered", false);
      el.select(".song-star-glow").attr("opacity", 0).attr("filter", null);
    }
  });
}

export function setSongHover(song) {
  if (!song) {
    clearSongHover();
    return;
  }
  appState.hoverAlbum = getAlbumKey(song);
  appState.hoveredSongId = song.song_id;
  refreshOverviewHighlight();
}

export function clearSongHover() {
  appState.hoverAlbum = null;
  appState.hoveredSongId = null;
  refreshOverviewHighlight();
}

export function applyAlbumHighlight(highlightAlbum) {
  appState.selectedAlbumHighlight = highlightAlbum;
  refreshOverviewHighlight();
}
