import * as d3 from "d3";

export function getTopEmotions(scoreObject, k = 3) {
  if (!scoreObject) return [];
  return Object.entries(scoreObject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([emotion, score]) => ({ emotion, score }));
}

export function getMostFrequentPrimaryEmotion(albumSongs) {
  const counts = d3.rollup(
    albumSongs,
    (v) => v.length,
    (d) => d.primary_emotion
  );
  let best = null;
  let max = 0;
  for (const [emotion, count] of counts) {
    if (count > max) {
      max = count;
      best = emotion;
    }
  }
  return best;
}

export function getStrongestSong(albumSongs) {
  return albumSongs.reduce(
    (best, s) =>
      !best || (s.primary_score ?? 0) > (best.primary_score ?? 0) ? s : best,
    null
  );
}
