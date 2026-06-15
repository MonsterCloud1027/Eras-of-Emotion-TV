'use strict'

import * as d3 from 'd3'

/**
 * Generates the SVG g element that will contain the treemap.
 *
 * @param {object} margin The margins around the graph area
 * @returns {*} d3 selection of the created g element
 */
export function generateG (margin) {
  return d3.select('.graph')
    .select('svg')
    .append('g')
    .attr('id', 'graph-g')
    .attr('transform', `translate(${margin.left},${margin.top})`)
}

/**
 * Sets the dimensions of the SVG canvas.
 *
 * @param {number} width Canvas width in pixels
 * @param {number} height Canvas height in pixels
 */
export function setCanvasSize (width, height) {
  d3.select('#treemap').select('svg')
    .attr('width', width)
    .attr('height', height)
}

/**
 * Builds the album timeline navigation buttons.
 *
 * @param {string[]} albums Ordered list of album names
 * @param {Function} onSelect Callback invoked with the selected album name
 */
export function buildTimeline (albums, onSelect) {
  d3.select('#album-timeline')
    .selectAll('.lyrical-album-btn')
    .data(albums)
    .join('button')
    .attr('class', 'lyrical-album-btn')
    .attr('id', d => `btn-${d.replace(/\s+/g, '-')}`)
    .text(d => d === 'The Tortured Poets Department' ? 'TTPD' : d)
    .attr('title', d => d)
    .on('click', (event, d) => onSelect(d))
}

/**
 * Marks the button for the given album as active.
 *
 * @param {string} album The album name to activate
 */
export function setActiveButton (album) {
  d3.selectAll('.lyrical-album-btn')
    .classed('active', d => d === album)
}
