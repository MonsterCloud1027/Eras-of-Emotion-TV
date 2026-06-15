"use strict";

import * as d3 from "d3";
import * as helper from "./scripts/helper.js";
import * as preproc from "./scripts/preprocess.js";
import * as viz from "./scripts/viz.js";
import * as hover from "./scripts/hover.js";

/**
 * @file Entry point for the lyrical themes treemap visualization.
 */

/**
 * Initializes the lyrical themes treemap.
 *
 * @param {string} dataUrl URL to the song emotion wheel JSON
 */
export function initLyricalThemes(dataUrl) {
  let svgSize;
  let graphSize;
  let currentAlbum;
  let meanScores;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  d3.json(dataUrl).then(function (data) {
    const albumData = preproc.buildAlbumEmotionData(data);
    const albums = preproc.getAlbumOrder(albumData);

    meanScores = preproc.buildMeanEmotionData(albumData);

    colorScale.domain(preproc.getEmotions(albumData));

    helper.buildTimeline(albums, selectAlbum);
    helper.generateG(margin);

    hover.initTooltip();

    setSizing();

    viz.initBaseLayout(meanScores, graphSize.width, graphSize.height);
    selectAlbum(albums[0], false);

    function setSizing() {
      const bounds = d3.select(".graph").node().getBoundingClientRect();

      svgSize = {
        width: bounds.width,
        height: Math.round(bounds.width / 1.6),
      };

      graphSize = {
        width: svgSize.width - margin.left - margin.right,
        height: svgSize.height - margin.top - margin.bottom,
      };

      helper.setCanvasSize(svgSize.width, svgSize.height);
    }

    function selectAlbum(album, animated = true) {
      currentAlbum = album;
      helper.setActiveButton(album);
      viz.update(
        albumData[album],
        graphSize.width,
        graphSize.height,
        colorScale,
        animated,
      );
    }

    window.addEventListener("resize", () => {
      setSizing();
      viz.resetLayout(meanScores, graphSize.width, graphSize.height);
      viz.update(
        albumData[currentAlbum],
        graphSize.width,
        graphSize.height,
        colorScale,
        false,
      );
    });
  });
}
