"use strict";

import * as d3 from "d3";

const tooltip = d3.select("#tooltip");

// From the PCA analysis, see the explore2 notebook
const top_emotions_composition = {
  "Heartbreak": ["Sadness", "Anger", "Fear"],
  "Romantic optimism": ["Joy", "Anticipation", "Trust"],
  "Vengeance": ["Anger", "Disgust"],
  "Anxiety": ["Fear", "Anticipation"]
};

/**
 * Initializes the tooltip element.
 */
export function initTooltip() {
  tooltip.style("display", "none");
}

/**
 * Shows the tooltip with information about the hovered treemap cell.
 *
 * @param {MouseEvent} event The mouse event that triggered the tooltip
 * @param {object} d The treemap leaf node datum
 */
export function showTooltip(event, d) {
  const emotions = top_emotions_composition[d.data.name];
  const emotionText = emotions ? `<span>${emotions.join(", ")}</span>` : "";

  tooltip
    .style("display", "block")
    .html(
      emotionText
    );
  moveTooltip(event);
}

/**
 * Repositions the tooltip to follow the cursor.
 *
 * @param {MouseEvent} event The current mouse event
 */
export function moveTooltip(event) {
  const gap = 14;
  const w = tooltip.node().offsetWidth;
  const h = tooltip.node().offsetHeight;
  let x = event.clientX + gap;
  let y = event.clientY + gap;
  if (x + w > window.innerWidth - 8) x = event.clientX - w - gap;
  if (y + h > window.innerHeight - 8) y = event.clientY - h - gap;
  tooltip.style("left", `${x}px`).style("top", `${y}px`);
}

/**
 * Hides the tooltip.
 */
export function hideTooltip() {
  tooltip.style("display", "none");
}
