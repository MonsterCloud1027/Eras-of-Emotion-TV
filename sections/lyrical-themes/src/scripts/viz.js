'use strict'

import * as d3 from 'd3'

import * as hover from './hover.js'

const MOVE_MS = 420 // Time to go from previous to new pos for the "blocks"
const FADE_MS = 200 // Same, but for the tail, i.e the dots that don't belong to a block
const STAGGER_MS = 1 // It seems that 1 is fast enough, even though we can still see soem artifacts

let layout = null

function themeBreakdown (dots) {
  const counts = new Map()
  const order = []
  for (const d of dots) {
    if (!counts.has(d.theme)) order.push(d.theme)
    counts.set(d.theme, (counts.get(d.theme) || 0) + 1)
  }
  return { counts, order }
}

function albumRowCount (dots, cols) {
  const { counts, order } = themeBreakdown(dots)
  return d3.sum(order, t => Math.ceil(counts.get(t) / cols))
}

function buildThemeInfo (dots, cols) {
  const { counts, order } = themeBreakdown(dots)
  const info = new Map()
  let startRow = 0
  for (const theme of order) {
    const count = counts.get(theme)
    info.set(theme, { startRow, count, fullRows: Math.floor(count / cols) })
    startRow += Math.ceil(count / cols)
  }
  return info
}

function dotPosition (dot, info) {
  const themeInfo = info.get(dot.theme)
  const col = dot.themeIndex % layout.cols
  const row = themeInfo.startRow + Math.floor(dot.themeIndex / layout.cols)
  return {
    x: col * layout.cellW + layout.cellW / 2,
    y: row * layout.cellH + layout.cellH / 2
  }
}

// Virtual because the dot might get removed with the fading, but it has to move before
function virtualNewY (dot, info) {
  const themeInfo = info.get(dot.theme)
  if (!themeInfo) return null
  const row = themeInfo.startRow + Math.floor(dot.themeIndex / layout.cols)
  return row * layout.cellH + layout.cellH / 2
}

export function computeGridLayout (albumDotsMap, width, height) {
  const albums = Object.values(albumDotsMap)
  const maxDots = d3.max(albums, d => d.length) ?? 0

  if (maxDots === 0) {
    return { cols: 0, rows: 0, cellW: 0, cellH: 0, radius: 0 }
  }

  const cols = Math.max(1, Math.floor(Math.sqrt(maxDots * (width / height))))
  const rows = Math.max(1, d3.max(albums, d => albumRowCount(d, cols)) ?? 1)
  const cellW = width / cols
  const cellH = height / rows
  const gap = Math.min(4, Math.min(cellW, cellH) * 0.2)
  const radius = Math.max(1, Math.min(cellW, cellH) / 2 - gap)

  return { cols, rows, cellW, cellH, radius }
}

export function initDots (albumDotsMap, width, height) {
  layout = computeGridLayout(albumDotsMap, width, height)
  d3.select('#graph-g').selectAll('.dot').remove()
}

export function updateDots (dots, colorScale, animated) {
  const info = buildThemeInfo(dots, layout.cols)

  const keyed = dots.map(dot => {
    const pos = dotPosition(dot, info)
    return { ...dot, x: pos.x, y: pos.y }
  })

  const circles = d3.select('#graph-g')
    .selectAll('.dot')
    .data(keyed, d => `${d.theme}#${d.themeIndex}`)

  if (animated) {
    // Collect exit data first so we can compute the indices for the fading
    const exitByTheme = {}
    circles.exit().each(function (d) {
      if (!exitByTheme[d.theme]) exitByTheme[d.theme] = []
      exitByTheme[d.theme].push({ node: this, d })
    })
    Object.values(exitByTheme).forEach(group => {
      // group.sort((a, b) => a.d.themeIndex - b.d.themeIndex)
      group.sort((a, b) => b.d.themeIndex - a.d.themeIndex)
      group.forEach(({ node, d }, i) => {
        const newY = virtualNewY(d, info)
        // If we spam transitions and the previous one is longer, without interrupt it looks VERY strange
        const circle = d3.select(node).interrupt()
        const fadeDelay = i * STAGGER_MS
        if (newY == null) {
          circle.transition().delay(fadeDelay).duration(FADE_MS).attr('opacity', 0).remove()
        } else {
          circle
            .transition().duration(MOVE_MS).ease(d3.easeCubicInOut)
            .attr('cy', newY)
            .on('end', function () {
              d3.select(this).transition().delay(fadeDelay).duration(FADE_MS).attr('opacity', 0).remove()
            })
        }
      })
    })

    // All dots slide vertically, horizontal sliding was a mess :(
    circles
      .interrupt()
      .transition().duration(MOVE_MS).ease(d3.easeCubicInOut)
      .attr('cy', d => d.y)
      .attr('opacity', 1)

    const themeEnterCounter = {}
    circles.enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', layout.radius)
      .attr('fill', d => colorScale(d.theme))
      .attr('opacity', 0)
      .attr('pointer-events', 'all')
      .on('mouseenter', (event, d) => hover.showTooltip(event, d))
      .on('mousemove', (event) => hover.moveTooltip(event))
      .on('mouseleave', () => hover.hideTooltip())
      .transition()
      .delay(d => {
        if (themeEnterCounter[d.theme] === undefined) themeEnterCounter[d.theme] = 0
        return MOVE_MS * 0.5 + themeEnterCounter[d.theme]++ * STAGGER_MS
      })
      .duration(FADE_MS)
      .ease(d3.easeCubicOut)
      .attr('opacity', 1)
  } else {
    circles.exit().remove()

    circles
      .interrupt()
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('opacity', 1)

    circles.enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', layout.radius)
      .attr('fill', d => colorScale(d.theme))
      .attr('opacity', 1)
      .attr('pointer-events', 'all')
      .on('mouseenter', (event, d) => hover.showTooltip(event, d))
      .on('mousemove', (event) => hover.moveTooltip(event))
      .on('mouseleave', () => hover.hideTooltip())
  }
}

export function resetLayout (albumDotsMap, width, height, currentDots, colorScale) {
  layout = computeGridLayout(albumDotsMap, width, height)

  d3.select('#graph-g')
    .selectAll('.dot')
    .attr('r', layout.radius)

  updateDots(currentDots, colorScale, false)
}

export function renderLegend (colorScale) {
  const container = d3.select('#theme-legend')
  if (container.empty()) return

  container.selectAll('*').remove()

  const items = container.append('div').attr('class', 'theme-legend__items')

  colorScale.domain().forEach(theme => {
    const item = items.append('div')
      .attr('class', 'theme-legend__item')
      .on('mouseenter', (event) => hover.showLegendTooltip(event, theme))
      .on('mousemove', (event) => hover.moveTooltip(event))
      .on('mouseleave', () => hover.hideTooltip())

    item.append('span')
      .attr('class', 'theme-legend__swatch')
      .style('background-color', colorScale(theme))
    item.append('span').attr('class', 'theme-legend__label').text(theme)
  })
}
