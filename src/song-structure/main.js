import "../styles/main.css";
import "../styles/nav.css";
import "../styles/lyrical-themes.css";
import "../styles/lyrical-analysis.css";

import { initSiteNav } from "../ui/site-nav.js";
import { loadSongStructures } from "../data/corpus.js";
import { renderDnaStrip, SECTION_BUCKETS } from "./dna-strip.js";

initSiteNav("other-vis-2");

const SORTS = [
  { key: "album", label: "Album order" },
  { key: "chorus", label: "Most chorus-heavy" },
  { key: "verse", label: "Most verse-heavy" },
  { key: "bridge", label: "Most bridge-heavy" },
  { key: "length", label: "Song length" },
];

const state = { sortBy: "album", groupByStyle: false };

function el(id) {
  return document.getElementById(id);
}

function renderLegend() {
  el("la-legend").innerHTML = SECTION_BUCKETS.map(
    (b) =>
      `<span class="la-legend__item"><span class="la-legend__swatch" style="background:${b.color}"></span>${b.key}</span>`
  ).join("");
}

function renderControls() {
  const host = el("la-controls");
  const sortPills = SORTS.map(
    (s) =>
      `<button class="la-pill${state.sortBy === s.key ? " is-active" : ""}" data-sort="${s.key}">${s.label}</button>`
  ).join("");
  host.innerHTML =
    `<span class="la-controls__label">Sort by</span>${sortPills}` +
    `<span class="la-controls__label" style="margin-left:1rem">Group</span>` +
    `<button class="la-pill${!state.groupByStyle ? " is-active" : ""}" data-group="off">All songs</button>` +
    `<button class="la-pill${state.groupByStyle ? " is-active" : ""}" data-group="on">By musical style</button>`;

  host.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => {
      state.sortBy = b.dataset.sort;
      draw();
    })
  );
  host.querySelectorAll("[data-group]").forEach((b) =>
    b.addEventListener("click", () => {
      state.groupByStyle = b.dataset.group === "on";
      draw();
    })
  );
}

function draw() {
  renderControls();
  renderLegend();
  renderDnaStrip(el("la-chart"), songs, {
    sortBy: state.sortBy,
    groupByStyle: state.groupByStyle,
  });
}

let songs = null;
loadSongStructures()
  .then((s) => {
    songs = s;
    draw();
  })
  .catch((err) => {
    console.error(err);
    el("la-chart").innerHTML = `<p style="color:var(--text-muted)">Failed to load song data.</p>`;
  });
