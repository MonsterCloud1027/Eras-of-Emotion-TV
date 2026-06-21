"use strict"

import * as d3 from "d3"

export const LINES_PER_DOT = 1

export const ALBUM_ORDER = [
  "Taylor Swift",
  "Fearless",
  "Speak Now",
  "Red",
  "1989",
  "Reputation",
  "Lover",
  "Folklore",
  "Evermore",
  "Midnights",
  "The Tortured Poets Department",
  "The Life Of A Showgirl"
]

export const THEMES = ["Heartbreak", "Romantic optimism", "Vengeance", "Anxiety"]

/**
 * @param {object} themeScores
 * @returns {string}
 */
function dominantTheme (themeScores) {
  return THEMES.reduce((best, theme) => {
    const score = themeScores?.[theme] ?? 0
    const bestScore = themeScores?.[best] ?? 0
    return score > bestScore ? theme : best
  }, THEMES[0])
}

/**
 * Streams lyric lines into dot-sized chunks for an ordered song list.
 *
 * @param {object[]} sortedSongs Songs in the desired order
 * @param {number} linesPerDot Lines represented by each dot
 * @returns {object[]}
 */
function streamDotsFromSongs (sortedSongs, linesPerDot) {
  const dots = []
  let songIdx = 0
  let lineInSong = 0

  while (songIdx < sortedSongs.length) {
    let linesInDot = 0
    let dotSong = sortedSongs[songIdx]

    while (linesInDot < linesPerDot && songIdx < sortedSongs.length) {
      const song = sortedSongs[songIdx]
      const songRemaining = song.n_lyrics - lineInSong
      const needed = linesPerDot - linesInDot
      const take = Math.min(needed, songRemaining)

      if (linesInDot === 0) dotSong = song

      linesInDot += take
      lineInSong += take

      if (lineInSong >= song.n_lyrics) {
        songIdx++
        lineInSong = 0
      }
    }

    dots.push({
      theme: dominantTheme(dotSong.theme_scores),
      song: dotSong,
      lines: linesInDot
    })
  }

  return dots
}

/**
 * Builds dots ordered by lyrical theme, then song track order within each theme.
 *
 * @param {object[]} songs Songs for one album
 * @param {number} linesPerDot Lines represented by each dot
 * @returns {object[]}
 */
export function buildAlbumDots (songs, linesPerDot) {
  const byTheme = d3.group(songs, s => dominantTheme(s.theme_scores))
  const dots = []

  THEMES.forEach(theme => {
    const themeSongs = byTheme.get(theme)
    if (!themeSongs) return

    const sorted = [...themeSongs].sort((a, b) => a.song_id.localeCompare(b.song_id))
    const themeDots = streamDotsFromSongs(sorted, linesPerDot)

    themeDots.forEach((dot, themeIndex) => {
      dots.push({ ...dot, themeIndex })
    })
  })

  return dots.map((dot, index) => ({ ...dot, index }))
}

/**
 * @param {object[]} songs
 * @param {number} [linesPerDot]
 * @returns {Record<string, object[]>}
 */
export function buildAllAlbumDots (songs) {
  const byAlbum = d3.group(
    songs.filter(s => s.album !== "Other Songs"),
    d => d.album
  )
  const result = {}

  ALBUM_ORDER.forEach(album => {
    const albumSongs = byAlbum.get(album)
    if (albumSongs) {
      result[album] = buildAlbumDots(albumSongs, LINES_PER_DOT)
    }
  })

  return result
}

/**
 * @param {Record<string, object[]>} albumDotsMap
 * @returns {number}
 */
export function computeMaxDots (albumDotsMap) {
  return d3.max(Object.values(albumDotsMap), dots => dots.length) ?? 0
}

/**
 * @param {Record<string, object[]>} albumDotsMap
 * @returns {string[]}
 */
export function getAlbumOrder (albumDotsMap) {
  return ALBUM_ORDER.filter(album => album in albumDotsMap)
}
