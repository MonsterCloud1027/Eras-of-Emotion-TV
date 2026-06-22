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

/**
 * Crossfade only in the middle band of each scroll step; holds full opacity on
 * either side so albums stay solid longer between transitions.
 */
const CROSSFADE_START = 0.30;
const CROSSFADE_END = 0.70;

function crossfadeOutgoing(t) {
  const x = Math.max(0, Math.min(1, t));
  if (x <= CROSSFADE_START) return 1;
  if (x >= CROSSFADE_END) return 0;
  return 1 - smoothstep((x - CROSSFADE_START) / (CROSSFADE_END - CROSSFADE_START));
}

function crossfadeIncoming(t) {
  const x = Math.max(0, Math.min(1, t));
  if (x <= CROSSFADE_START) return 0;
  if (x >= CROSSFADE_END) return 1;
  return smoothstep((x - CROSSFADE_START) / (CROSSFADE_END - CROSSFADE_START));
}

/** stepFloat that lands in the incoming album's solid hold (or global at step 0). */
function scrollSnapStepFloat(stepIndex) {
  if (stepIndex <= 0) return CROSSFADE_START * 0.25;
  return (stepIndex - 1) + (CROSSFADE_END + 1) / 2;
}

/** Opacity crossfade: step 0 = global grid, then one step per album cover. */
export function computeScrollOpacities(stepFloat, albumOrder) {
  const opacityByKey = { global: 0 };
  albumOrder.forEach((a) => {
    opacityByKey[a] = 0;
  });

  if (!albumOrder.length) {
    opacityByKey.global = 1;
    return { opacityByKey, outgoingKey: null, incomingKey: null, stepT: null };
  }

  const i = Math.floor(stepFloat);
  const t = Math.max(0, Math.min(1, stepFloat - i));
  const out = crossfadeOutgoing(t);
  const inn = crossfadeIncoming(t);

  if (i <= 0) {
    opacityByKey.global = out;
    opacityByKey[albumOrder[0]] = inn;
    return {
      opacityByKey,
      outgoingKey: "global",
      incomingKey: albumOrder[0],
      stepT: t,
    };
  }

  if (i >= albumOrder.length) {
    opacityByKey[albumOrder[albumOrder.length - 1]] = 1;
    return { opacityByKey, outgoingKey: null, incomingKey: null, stepT: null };
  }

  opacityByKey[albumOrder[i - 1]] = out;
  opacityByKey[albumOrder[i]] = inn;
  return {
    opacityByKey,
    outgoingKey: albumOrder[i - 1],
    incomingKey: albumOrder[i],
    stepT: t,
  };
}

export function buildCoverLayers(albumOrder) {
  const root = d3.select("#hero-cover-layers");
  root.selectAll("*").remove();

  const withCovers = albumsWithCovers(albumOrder);

  const grid = root
    .append("div")
    .attr("class", "cover-layer cover-layer--grid is-marquee-active")
    .attr("data-layer", "global");

  if (!withCovers.length) return;

  const row = grid
    .append("div")
    .attr("class", "cover-grid-row")
    .attr("data-row", 0)
    .attr("data-direction", "left");

  const track = row.append("div").attr("class", "cover-grid-row-track");

  [...withCovers, ...withCovers].forEach((album) => {
    const url = getAlbumCoverUrl(album);
    track
      .append("div")
      .attr("class", "cover-grid-cell")
      .attr("data-album", album)
      .style("background-image", `url("${url}")`);
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
  const targetStepFloat = scrollSnapStepFloat(stepIndex);
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

  const scrollState = computeScrollOpacities(stepFloat, albumOrder);
  setContentLayerOpacities(scrollState.opacityByKey, {
    outgoingKey: scrollState.outgoingKey,
    incomingKey: scrollState.incomingKey,
    stepT: scrollState.stepT,
  });
  updateStageLabel(scrollState.opacityByKey, albumOrder);
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
