import * as d3 from "d3";
import {
  ALBUM_COLOR_PALETTE,
  ALBUM_DISPLAY_ORDER,
  DATA_URL,
} from "../config/constants.js";
import { appState } from "../state/app-state.js";

export async function loadData() {
  const data = await d3.json(DATA_URL);
  if (!Array.isArray(data)) {
    throw new Error("Expected song emotion wheel JSON to be an array");
  }
  return data;
}

export function getAlbumKey(song) {
  return song.album || song.album_code || "Unknown";
}

export function getTrackNumber(song) {
  if (song.track_number != null && !Number.isNaN(Number(song.track_number))) {
    return Number(song.track_number);
  }
  const match = String(song.song_id || "").match(/:(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function sortSongsWithinAlbum(songs) {
  return [...songs].sort((a, b) => {
    const ta = getTrackNumber(a);
    const tb = getTrackNumber(b);
    if (ta !== tb) return ta - tb;
    return String(a.song_id).localeCompare(String(b.song_id), undefined, {
      numeric: true,
    });
  });
}

/** Clockwise order on the SVG wheel (matches atan2(y, x) in data space). */
export function sortSongsByAngleClockwise(songs) {
  return [...songs].sort(
    (a, b) => Math.atan2(a.y ?? 0, a.x ?? 0) - Math.atan2(b.y ?? 0, b.x ?? 0)
  );
}

function albumSortIndex(albumName) {
  const i = ALBUM_DISPLAY_ORDER.indexOf(albumName);
  return i >= 0 ? i : ALBUM_DISPLAY_ORDER.length;
}

export function groupSongsByAlbum(data) {
  const grouped = d3.group(data, getAlbumKey);
  const entries = [...grouped.entries()].map(([album, songs]) => [
    album,
    sortSongsWithinAlbum(songs),
  ]);
  entries.sort((a, b) => albumSortIndex(a[0]) - albumSortIndex(b[0]));
  return new Map(entries);
}

export function buildAlbumColorScale(data) {
  const albums = [...new Set(data.map(getAlbumKey))].sort(
    (a, b) => albumSortIndex(a) - albumSortIndex(b)
  );
  appState.albumColorScale = d3
    .scaleOrdinal()
    .domain(albums)
    .range(ALBUM_COLOR_PALETTE);
  return appState.albumColorScale;
}
