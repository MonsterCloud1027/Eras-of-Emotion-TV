'use strict'

import * as d3 from 'd3'

const tooltip = d3.select('#tooltip')

const topEmotionsComposition = {
  'Heartbreak': ['Sadness', 'Anger', 'Fear'],
  'Romantic optimism': ['Joy', 'Anticipation', 'Trust'],
  'Vengeance': ['Anger', 'Disgust'],
  'Anxiety': ['Fear', 'Anticipation']
}

export function initTooltip () {
  tooltip.style('display', 'none')
}

/**
 * @param {string} theme
 * @returns {string}
 */
export function themeEmotionText (theme) {
  const emotions = topEmotionsComposition[theme]
  return emotions ? emotions.join(', ') : ''
}

/**
 * @param {MouseEvent} event
 * @param {string} theme
 */
export function showLegendTooltip (event, theme) {
  const emotionText = themeEmotionText(theme)
  if (!emotionText) return

  tooltip
    .style('display', 'block')
    .text(emotionText)

  moveTooltip(event)
}

/**
 * @param {MouseEvent} event
 * @param {object} dot
 */
export function showTooltip (event, dot) {
  tooltip
    .style('display', 'block')
    .html(`<strong>${dot.song.song_title}</strong>`)

  moveTooltip(event)
}

/**
 * @param {MouseEvent} event
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

export function hideTooltip () {
  tooltip.style('display', 'none')
}
