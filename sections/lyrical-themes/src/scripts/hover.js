'use strict'

const tooltip = d3.select('#tooltip')

/**
 * Initializes the tooltip element.
 */
export function initTooltip () {
  tooltip.style('display', 'none')
}

/**
 * Shows the tooltip with information about the hovered treemap cell.
 *
 * @param {MouseEvent} event The mouse event that triggered the tooltip
 * @param {object} d The treemap leaf node datum
 */
export function showTooltip (event, d) {
  tooltip
    .style('display', 'block')
    .html(`<strong>${d.data.name}</strong><br>avg: ${d.data.value.toFixed(3)} &nbsp;·&nbsp; ${(d.data.pct * 100).toFixed(1)}%`)
  moveTooltip(event)
}

/**
 * Repositions the tooltip to follow the cursor.
 *
 * @param {MouseEvent} event The current mouse event
 */
export function moveTooltip (event) {
  const gap = 14
  const w = tooltip.node().offsetWidth
  const h = tooltip.node().offsetHeight
  let x = event.clientX + gap
  let y = event.clientY + gap
  if (x + w > window.innerWidth - 8) x = event.clientX - w - gap
  if (y + h > window.innerHeight - 8) y = event.clientY - h - gap
  tooltip.style('left', `${x}px`).style('top', `${y}px`)
}

/**
 * Hides the tooltip.
 */
export function hideTooltip () {
  tooltip.style('display', 'none')
}
