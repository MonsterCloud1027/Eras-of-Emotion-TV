import { ALBUM_DISPLAY_ORDER } from "./constants.js";

export const ALBUM_COVER_BASE = "/image/album";

/** Album display name → filename in public/image/album/ */
export const ALBUM_COVER_FILES = {
  "Taylor Swift": "taylor-swift-self-titled-billboard-1240.webp",
  Fearless:
    "Taylor-Swift-fearless-album-art-cr-Beth-Garrabrant-billboard-1240-1617974663.webp",
  "Speak Now": "Speak-Now-Taylors-Version-billboard-1240.webp",
  Red: "taylor-swift-red-taylors-version-billboard-1240.webp",
  1989: "1989.webp",
  Reputation: "taylor-swift-reputation-billboard-1240.webp",
  Lover: "Taylor-Swift-Lover-album-art-2019-billboard-1240.webp",
  Folklore: "Taylor-swift-folklore-cover-billboard-1240-1607121703.webp",
  Evermore: "evermore.webp",
  Midnights: "taylor-swift-midnights-album-cover-2022-billboard-1240.webp",
  "The Tortured Poets Department":
    "The-Tortured-Poets-Department-artwork-billboard-1240.webp",
  "The Life Of A Showgirl":
    "life-of-a-showgirl-2025-album-cover-taylor-swift-billboard-1200.webp",
};

export function getAlbumCoverUrl(albumName) {
  const file = ALBUM_COVER_FILES[albumName];
  if (!file) return null;
  return `${ALBUM_COVER_BASE}/${file}`;
}

export function albumsWithCovers(albumOrder = ALBUM_DISPLAY_ORDER) {
  return albumOrder.filter((name) => getAlbumCoverUrl(name));
}
