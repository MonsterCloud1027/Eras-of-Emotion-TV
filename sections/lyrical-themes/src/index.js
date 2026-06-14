"use strict";

import * as helper from "./scripts/helper.js";
import * as preproc from "./scripts/preprocess.js";
import * as viz from "./scripts/viz.js";
import * as hover from "./scripts/hover.js";

/**
 * @file Entry point for the lyrical themes treemap visualization.
 */
(function (d3) {
  let svgSize;
  let graphSize;
  let currentAlbum;
  let meanScores;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  d3.json("song_emotion_wheel_data.llm.json").then(function (data) {
    const albumData = preproc.buildAlbumEmotionData(data);
    const albums = preproc.getAlbumOrder(albumData);

    // Mean scores are used once to build the stable base layout
    meanScores = preproc.buildMeanEmotionData(albumData);

    colorScale.domain(preproc.getEmotions(albumData));

    helper.buildTimeline(albums, selectAlbum);
    helper.generateG(margin);

    hover.initTooltip();

    setSizing();

    // Compute stable base layout from mean scores (sets d.z for resquarify)
    viz.initBaseLayout(meanScores, graphSize.width, graphSize.height);
    selectAlbum(albums[0], false);

    /**
     * Handles sizing of the SVG canvas.
     */
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

    /**
     * Selects an album and updates the treemap.
     *
     * @param {string} album The album name to display
     * @param {boolean} animated Whether to animate the transition
     */
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
      // Rebuild base layout at new size, then re-render current album
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
})(d3);
