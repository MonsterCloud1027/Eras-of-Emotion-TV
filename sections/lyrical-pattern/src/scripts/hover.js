"use strict";

import * as d3 from "d3";

const tooltip = d3.select("#tooltip");

/**
 * Initializes the tooltip element.
 */
export function initTooltip() {
  tooltip.classed("visible", false);
}

/**
 * Shows the tooltip near the cursor with the given HTML content.
 *
 * @param {string} html Tooltip inner HTML
 * @param {MouseEvent} event The triggering mouse event
 */
export function showTip(html, event) {
  tooltip.html(html);
  tooltip.classed("visible", true);
  tooltip.style("left", (event.clientX + 16) + "px");
  tooltip.style("top",  (event.clientY - 10) + "px");
}

/**
 * Hides the tooltip.
 */
export function hideTip() {
  tooltip.classed("visible", false);
}
