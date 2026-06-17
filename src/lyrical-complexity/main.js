import "../styles/main.css";
import "../styles/nav.css";
import "../styles/lyrical-themes.css";
import "../styles/lyrical-analysis.css";

import { initSiteNav } from "../ui/site-nav.js";
import { loadComplexity, CEFR_LEVELS } from "../data/corpus.js";
import { renderDotMatrix } from "./dot-matrix.js";
import { renderRiver, CEFR_INFO } from "./river.js";

initSiteNav("other-vis-1");

const VIEWS = {
  matrix: {
    label: "Song dot-matrix",
    caption:
      "Each circle is one song, placed in its album column and CEFR complexity band. Colour shows average OEC word-frequency rank — darker means rarer vocabulary.",
  },
  river: {
    label: "Vocabulary river",
    caption:
      "How the mix of CEFR vocabulary levels (A1 elementary → C1 advanced) shifts across albums. The line below tracks each album's average word level.",
  },
};

const state = { view: "matrix", riverMode: "full" };

function el(id) {
  return document.getElementById(id);
}

function renderControls() {
  const host = el("la-controls");
  const viewPills = Object.entries(VIEWS)
    .map(
      ([key, v]) =>
        `<button class="la-pill${state.view === key ? " is-active" : ""}" data-view="${key}">${v.label}</button>`
    )
    .join("");
  const riverPills =
    state.view === "river"
      ? `<span class="la-controls__label" style="margin-left:1rem">Detail</span>
         <button class="la-pill${state.riverMode === "full" ? " is-active" : ""}" data-river="full">Full breakdown</button>
         <button class="la-pill${state.riverMode === "above" ? " is-active" : ""}" data-river="above">Zoom: above A1 only</button>`
      : "";
  host.innerHTML = `<span class="la-controls__label">View</span>${viewPills}${riverPills}`;

  host.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      state.view = b.dataset.view;
      draw();
    })
  );
  host.querySelectorAll("[data-river]").forEach((b) =>
    b.addEventListener("click", () => {
      state.riverMode = b.dataset.river;
      draw();
    })
  );
}

function renderLegend() {
  const host = el("la-legend");
  if (state.view === "river") {
    const levels = state.riverMode === "above" ? CEFR_LEVELS.slice(1) : CEFR_LEVELS;
    host.innerHTML = levels
      .map(
        (l) =>
          `<span class="la-legend__item"><span class="la-legend__swatch" style="background:${CEFR_INFO[l].color}"></span>${CEFR_INFO[l].label}</span>`
      )
      .join("");
  } else {
    host.innerHTML = `<span class="la-legend__item" style="color:var(--text-muted)">Circle colour = avg OEC rank · purple ring = From The Vault track</span>`;
  }
}

function draw() {
  renderControls();
  renderLegend();
  el("la-caption").textContent = VIEWS[state.view].caption;
  const chart = el("la-chart");
  if (state.view === "matrix") {
    renderDotMatrix(chart, data);
  } else {
    renderRiver(chart, data, { mode: state.riverMode });
  }
}

let data = null;
loadComplexity()
  .then((d) => {
    data = d;
    draw();
  })
  .catch((err) => {
    console.error(err);
    el("la-chart").innerHTML = `<p style="color:var(--text-muted)">Failed to load lyric data.</p>`;
  });
