"use strict";

import * as hover from "./scripts/hover.js";
import { drawHeatmap } from "./scripts/viz.js";

export function initLyricalPatterns() {
  hover.initTooltip();
  drawHeatmap();
  window.addEventListener("resize", drawHeatmap);
}
