'use strict'

import * as d3 from 'd3'
import * as helper from './scripts/helper.js'
import * as preproc from './scripts/preprocess.js'
import * as viz from './scripts/viz.js'
import * as hover from './scripts/hover.js'

const THEME_COLORS = {
  'Heartbreak': '#8B3A3A',
  'Romantic optimism': '#D4A03C',
  'Vengeance': '#6B4C9A',
  'Anxiety': '#5C7A8A'
}

/**
 * @param {string} dataUrl
 */
export function initLyricalThemes (dataUrl) {
  let svgSize;
  let graphSize;
  let currentAlbum;
  let albumDots;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 }
  const colorScale = d3.scaleOrdinal()
    .domain(preproc.THEMES)
    .range(preproc.THEMES.map(t => THEME_COLORS[t]))

  d3.json(dataUrl).then(function (data) {
    albumDots = preproc.buildAllAlbumDots(data)
    const albums = preproc.getAlbumOrder(albumDots)

    helper.buildTimeline(albums, selectAlbum)
    helper.generateG(margin)
    hover.initTooltip()
    viz.renderLegend(colorScale)

    setSizing()
    viz.initDots(albumDots, graphSize.width, graphSize.height)
    selectAlbum(albums[0], false)

    function setSizing () {
      const bounds = d3.select('.graph').node().getBoundingClientRect()

      svgSize = {
        width: bounds.width,
        height: Math.round(bounds.width / 1.6)
      }

      graphSize = {
        width: svgSize.width - margin.left - margin.right,
        height: svgSize.height - margin.top - margin.bottom
      }

      helper.setCanvasSize(svgSize.width, svgSize.height)
    }

    function selectAlbum (album, animated = true) {
      currentAlbum = album
      helper.setActiveButton(album)
      viz.updateDots(albumDots[album], colorScale, animated)
    }

    window.addEventListener('resize', () => {
      setSizing()
      viz.resetLayout(
        albumDots,
        graphSize.width,
        graphSize.height,
        albumDots[currentAlbum],
        colorScale
      )
    })
  })
}
