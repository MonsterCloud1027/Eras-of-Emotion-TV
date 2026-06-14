'use strict'

import * as preproc from './preprocess.js'
import * as hover from './hover.js'

const TRANSITION_MS = 650

const treemap = d3.treemap()
  .tile(d3.treemapResquarify)
  .paddingOuter(4)
  .paddingInner(3)
  .round(true)

/**
 * Persistent d3 hierarchy built from mean emotion scores.
 * Keeping the same object across calls preserves the `d.z` ratios that
 * treemapResquarify uses to maintain stable splits.
 * @type {object|null}
 */
let rootHierarchy = null

/**
 * Initialises the persistent hierarchy from mean emotion scores and runs the
 * treemap layout once to record the initial tile ratios (d.z).
 * Must be called once before any updates.
 *
 * @param {object} meanScores Mean emotion scores across all albums
 * @param {number} width Graph width in pixels
 * @param {number} height Graph height in pixels
 */
export function initBaseLayout (meanScores, width, height) {
  treemap.size([width, height])
  rootHierarchy = preproc.buildHierarchy(meanScores)
  treemap(rootHierarchy) // sets d.z on every node for resquarify
}

/**
 * Updates the persistent hierarchy with per-album values and re-runs the
 * treemap. Because treemapResquarify reuses the stored d.z ratios it produces
 * the same splits as the initial mean layout — only widths and heights change.
 *
 * @param {object} emotionScores Emotion scores for the selected album
 * @param {number} width Graph width in pixels
 * @param {number} height Graph height in pixels
 * @returns {object} The updated d3 hierarchy root with new layout coordinates
 */
function computeLayoutForAlbum (emotionScores, width, height) {
  treemap.size([width, height])

  const total = d3.sum(Object.values(emotionScores))

  // Update leaf values in-place so d.z is preserved for resquarify
  rootHierarchy.leaves().forEach(leaf => {
    const val = emotionScores[leaf.data.name] || 0
    leaf.data.value = val
    leaf.data.pct = total > 0 ? val / total : 0
  })

  // Re-sum propagates updated leaf values up the hierarchy
  rootHierarchy.sum(d => d.value)

  // treemapResquarify reuses d.z → same splits, different sizes
  return treemap(rootHierarchy)
}

/**
 * Appends the initial SVG group elements for each emotion cell.
 * Called once the first time cells don't yet exist in the DOM.
 *
 * @param {object[]} leaves Treemap leaf nodes with layout coordinates
 * @param {*} colorScale The d3 color scale for emotions
 */
function appendCells (leaves, colorScale) {
  d3.select('#graph-g')
    .selectAll('.cell')
    .data(leaves, d => d.data.name)
    .join('g')
    .attr('class', 'cell')
    .each(function (d) {
      const cell = d3.select(this)

      cell.append('rect')
        .attr('class', 'cell-rect')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('x', d.x0)
        .attr('y', d.y0)
        .attr('width', Math.max(0, d.x1 - d.x0))
        .attr('height', Math.max(0, d.y1 - d.y0))
        .attr('fill', colorScale(d.data.name))

      cell.append('text')
        .attr('class', 'cell-label')
        .attr('x', (d.x0 + d.x1) / 2)
        .attr('y', labelY(d, false))
        .attr('font-size', labelSize(d))
        .attr('fill', '#fff')
        .attr('opacity', labelVisible(d) ? 1 : 0)
        .text(d.data.name)

      cell.append('text')
        .attr('class', 'cell-pct')
        .attr('x', (d.x0 + d.x1) / 2)
        .attr('y', labelY(d, true))
        .attr('font-size', pctSize(d))
        .attr('fill', 'rgba(255,255,255,0.75)')
        .attr('opacity', pctVisible(d) ? 1 : 0)
        .text(`${(d.data.pct * 100).toFixed(1)}%`)
    })

  d3.select('#graph-g')
    .selectAll('.cell')
    .on('mouseenter', (event, d) => hover.showTooltip(event, d))
    .on('mousemove', (event) => hover.moveTooltip(event))
    .on('mouseleave', () => hover.hideTooltip())
}

/**
 * Updates the treemap to reflect a new album's emotion scores.
 * The tree structure (splits) stays identical to the mean-based base layout;
 * only cell sizes and percentage labels animate.
 *
 * @param {object} emotionScores Emotion scores for the selected album
 * @param {number} width Graph width in pixels
 * @param {number} height Graph height in pixels
 * @param {*} colorScale The d3 color scale for emotions
 * @param {boolean} animated Whether to animate the transition
 */
export function update (emotionScores, width, height, colorScale, animated) {
  const root = computeLayoutForAlbum(emotionScores, width, height)
  const leaves = root.leaves()

  const t = animated
    ? d3.transition().duration(TRANSITION_MS).ease(d3.easeCubicInOut)
    : d3.transition().duration(0)

  const cells = d3.select('#graph-g')
    .selectAll('.cell')
    .data(leaves, d => d.data.name)

  if (cells.empty()) {
    appendCells(leaves, colorScale)
    return
  }

  cells.select('.cell-rect')
    .transition(t)
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => colorScale(d.data.name))

  cells.select('.cell-label')
    .transition(t)
    .attr('x', d => (d.x0 + d.x1) / 2)
    .attr('y', d => labelY(d, false))
    .attr('font-size', d => labelSize(d))
    .attr('opacity', d => labelVisible(d) ? 1 : 0)

  cells.select('.cell-pct')
    .transition(t)
    .attr('x', d => (d.x0 + d.x1) / 2)
    .attr('y', d => labelY(d, true))
    .attr('font-size', d => pctSize(d))
    .attr('opacity', d => pctVisible(d) ? 1 : 0)
    .text(d => `${(d.data.pct * 100).toFixed(1)}%`)
}

/**
 * Resets and rebuilds the base layout at a new canvas size.
 * Should be called on window resize before update().
 *
 * @param {object} meanScores Mean emotion scores
 * @param {number} width New graph width
 * @param {number} height New graph height
 */
export function resetLayout (meanScores, width, height) {
  rootHierarchy = null
  initBaseLayout(meanScores, width, height)
}

// ── Label helpers ────────────────────────────────────────────────────────────

function labelY (d, isPct) {
  const mid = (d.y0 + d.y1) / 2
  const h = d.y1 - d.y0
  const w = d.x1 - d.x0
  if (h > 55 && w > 65) {
    return isPct ? mid + 14 : mid - 10
  }
  return mid
}

function labelSize (d) {
  const min = Math.min(d.x1 - d.x0, d.y1 - d.y0)
  return `${Math.max(10, Math.min(min * 0.18, 26))}px`
}

function pctSize (d) {
  const min = Math.min(d.x1 - d.x0, d.y1 - d.y0)
  return `${Math.max(9, Math.min(min * 0.11, 15))}px`
}

function labelVisible (d) {
  return (d.x1 - d.x0) > 55 && (d.y1 - d.y0) > 28
}

function pctVisible (d) {
  return (d.x1 - d.x0) > 65 && (d.y1 - d.y0) > 55
}
