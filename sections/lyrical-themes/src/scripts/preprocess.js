'use strict'

const ALBUM_ORDER = [
  'Taylor Swift',
  'Fearless',
  'Speak Now',
  'Red',
  '1989',
  'Reputation',
  'Lover',
  'Folklore',
  'Evermore',
  'Midnights',
  'The Tortured Poets Department',
  'The Life Of A Showgirl'
]

const EMOTIONS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']

/**
 * Aggregates song data into per-album average emotion scores.
 *
 * @param {object[]} songs The raw song data array
 * @returns {object} Map of album name to emotion score averages
 */
export function buildAlbumEmotionData (songs) {
  const byAlbum = d3.group(songs, d => d.album)
  const result = {}

  ALBUM_ORDER.forEach(album => {
    const albumSongs = byAlbum.get(album)
    if (!albumSongs) return

    const scores = {}
    EMOTIONS.forEach(emotion => {
      scores[emotion] = d3.mean(albumSongs, s => (s.emotion_scores_mean || {})[emotion] || 0)
    })
    result[album] = scores
  })

  return result
}

/**
 * Returns the ordered list of album names present in the data.
 *
 * @param {object} albumData The aggregated album emotion data
 * @returns {string[]} Ordered album names
 */
export function getAlbumOrder (albumData) {
  return ALBUM_ORDER.filter(album => album in albumData)
}

/**
 * Computes mean emotion scores across all albums.
 * Used to build a stable treemap layout whose positions don't change between albums.
 *
 * @param {object} albumData Map of album name to emotion score averages
 * @returns {object} Map of emotion name to mean score across all albums
 */
export function buildMeanEmotionData (albumData) {
  const albums = Object.values(albumData)
  const result = {}
  EMOTIONS.forEach(emotion => {
    result[emotion] = d3.mean(albums, a => a[emotion] || 0)
  })
  return result
}

/**
 * Returns the list of emotion names.
 *
 * @param {object} albumData The aggregated album emotion data
 * @returns {string[]} Emotion names
 */
export function getEmotions (albumData) {
  const first = Object.values(albumData)[0]
  return first ? Object.keys(first) : []
}

/**
 * Converts an album's emotion scores into a d3 hierarchy for treemap layout.
 *
 * @param {object} emotionScores Map of emotion name to average score
 * @returns {object} d3 hierarchy root with summed values
 */
export function buildHierarchy (emotionScores) {
  const total = d3.sum(Object.values(emotionScores))
  return d3.hierarchy({
    name: 'root',
    children: EMOTIONS.map(name => ({
      name,
      value: emotionScores[name] || 0,
      pct: total > 0 ? (emotionScores[name] || 0) / total : 0
    }))
  }).sum(d => d.value)
}
