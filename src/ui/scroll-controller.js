import * as d3 from "d3";
import { getAlbumCoverUrl, albumsWithCovers } from "../config/album-covers.js";
import { groupSongsByAlbum } from "../data/songs.js";
import { appState } from "../state/app-state.js";
import { SCROLL_STEP_VH } from "../config/constants.js";
import { pickScrollFocusAlbum } from "../viz/highlight.js";
import { isSongDrilldownActive } from "../viz/song-drilldown.js";
import { setContentLayerOpacities } from "../viz/scroll-galaxy.js";

/** Matches `updateFromScroll` focal line (fraction of viewport height). */
export const SCROLL_FOCUS_VH = 0.38;

function stepUnitPx() {
  return window.innerHeight * SCROLL_STEP_VH;
}

function applyScrollStepCssVar() {
  document.documentElement.style.setProperty(
    "--scroll-step-vh",
    String(SCROLL_STEP_VH)
  );
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Outgoing layer: mostly gone in the first ~40% of the step. */
function crossfadeOutgoing(t) {
  const x = Math.max(0, Math.min(1, t));
  return Math.max(0, 1 - x * 2.5);
}

/** Incoming layer: rises after a short hold so the previous can clear first. */
function crossfadeIncoming(t) {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.15) return 0;
  return smoothstep((x - 0.15) / 0.85);
}

/** Opacity crossfade: step 0 = global grid, then one step per album cover. */
export function computeScrollOpacities(stepFloat, albumOrder) {
  const op = { global: 0 };
  albumOrder.forEach((a) => {
    op[a] = 0;
  });

  if (!albumOrder.length) {
    op.global = 1;
    return op;
  }

  const i = Math.floor(stepFloat);
  const t = Math.max(0, Math.min(1, stepFloat - i));
  const out = crossfadeOutgoing(t);
  const inn = crossfadeIncoming(t);

  if (i <= 0) {
    op.global = out;
    op[albumOrder[0]] = inn;
  } else if (i >= albumOrder.length) {
    op[albumOrder[albumOrder.length - 1]] = 1;
  } else {
    op[albumOrder[i - 1]] = out;
    op[albumOrder[i]] = inn;
  }

  return op;
}

export function buildCoverLayers(albumOrder) {
  const root = d3.select("#scroll-cover-layers");
  root.selectAll("*").remove();

  const withCovers = albumsWithCovers(albumOrder);

  const grid = root
    .append("div")
    .attr("class", "cover-layer cover-layer--grid")
    .attr("data-layer", "global");

  withCovers.forEach((album) => {
    const url = getAlbumCoverUrl(album);
    grid
      .append("div")
      .attr("class", "cover-grid-cell")
      .attr("data-album", album)
      .style("background-image", `url("${url}")`);
  });

  albumOrder.forEach((album) => {
    const url = getAlbumCoverUrl(album);
    if (!url) return;
    root
      .append("div")
      .attr("class", "cover-layer cover-layer--album")
      .attr("data-album", album)
      .attr("data-layer", "album")
      .style("background-image", `url("${url}")`);
  });
}

export function setCoverLayerOpacities(opacityByKey) {
  const grid = d3.select(".cover-layer--grid");
  if (!grid.empty()) {
    grid.style("opacity", opacityByKey.global ?? 0);
  }

  d3.selectAll(".cover-layer--album").each(function () {
    const album = d3.select(this).attr("data-album");
    d3.select(this).style("opacity", opacityByKey[album] ?? 0);
  });
}

/** Scroll spacers only (backgrounds handled by sticky cover layers). */
export function buildScrollTrack(data) {
  applyScrollStepCssVar();
  const grouped = groupSongsByAlbum(data);
  const albumOrder = [...grouped.keys()];
  const track = d3.select("#scroll-track");
  track.selectAll("*").remove();

  track
    .append("section")
    .attr("class", "scroll-step scroll-step--global")
    .attr("data-step-index", 0)
    .attr("aria-label", "All albums");

  let index = 1;
  for (const albumName of albumOrder) {
    track
      .append("section")
      .attr("class", "scroll-step scroll-step--album")
      .attr("data-step-index", index)
      .attr("data-album", albumName)
      .attr("aria-label", albumName);
    index += 1;
  }

  appState.albumOrder = albumOrder;
  appState.albumScrollIndex = new Map(
    albumOrder.map((name, i) => [name, i + 1])
  );

  return { grouped, albumOrder };
}

/** Scroll so step `stepIndex` (0 = global) is in focus. */
export function scrollToStepIndex(stepIndex) {
  const track = document.getElementById("scroll-track");
  if (!track) return;

  const vh = window.innerHeight;
  const unit = stepUnitPx();
  const trackTop = track.getBoundingClientRect().top + window.scrollY;
  const targetStepFloat = stepIndex + 0.15;
  const targetScrollY = trackTop + targetStepFloat * unit - vh * SCROLL_FOCUS_VH;

  window.scrollTo({
    top: Math.max(0, targetScrollY),
    behavior: "smooth",
  });
}

export function scrollToGlobal() {
  scrollToStepIndex(0);
}

export function scrollToAlbum(albumName) {
  const stepIndex = appState.albumScrollIndex?.get(albumName);
  if (stepIndex == null) return;
  scrollToStepIndex(stepIndex);
}

function updateStageLabel(opacityByKey, albumOrder) {
  const label = d3.select("#scroll-stage-label");
  const focusAlbum = pickScrollFocusAlbum(opacityByKey, albumOrder);

  if (focusAlbum == null) {
    label.html(
      `<span class="stage-label-eyebrow">View</span><span class="stage-label-title">Global Galaxy</span>`
    );
  } else {
    const color = appState.albumColorScale(focusAlbum);
    label.html(
      `<span class="stage-label-eyebrow">Album</span>` +
        `<span class="stage-label-title" style="color:${color}">${focusAlbum}</span>`
    );
  }
}

function updateFromScroll() {
  const track = document.getElementById("scroll-track");
  if (!track || !appState.overviewLayers) return;

  if (isSongDrilldownActive()) {
    return;
  }

  const albumOrder = appState.overviewLayers.albumOrder ?? [];
  const vh = window.innerHeight;
  const unit = stepUnitPx();
  const trackTop = track.getBoundingClientRect().top + window.scrollY;
  const relY = window.scrollY - trackTop + vh * SCROLL_FOCUS_VH;
  const stepFloat = Math.max(0, relY / unit);

  const opacityByKey = computeScrollOpacities(stepFloat, albumOrder);
  setContentLayerOpacities(opacityByKey);
  setCoverLayerOpacities(opacityByKey);
  updateStageLabel(opacityByKey, albumOrder);
}

export function initScrollController() {
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateFromScroll();
      ticking = false;
    });
  };

  applyScrollStepCssVar();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateFromScroll();
}
