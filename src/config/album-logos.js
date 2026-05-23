import { ALBUM_DISPLAY_ORDER, assetUrl } from "./constants.js";

/** Album display name → exact filename in public/image/ */
export const ALBUM_LOGO_FILES = {
  "Taylor Swift": "logo-Taylor-Swift.png",
  Fearless: "logo-Fearless-1.png",
  "Speak Now": "logo-Speak-Now-1.png",
  Red: "logo-Red-1.png",
  1989: "logo-1989-TV.png",
  Reputation: "logo-Reputation.png",
  Lover: "logo-Lover.png",
  Folklore: "logo-Folkore.png",
  Evermore: "logo-Evermore.png",
  Midnights: "logo-Midnights.png",
  "The Tortured Poets Department": "logo-TTPD.png",
  "The Life Of A Showgirl": "logo-tloas-1.png",
  // Other Songs: no logo file yet
};

export function getAlbumLogoUrl(albumName) {
  const file = ALBUM_LOGO_FILES[albumName];
  if (!file) return null;
  return assetUrl(`image/${file}`);
}

export function albumNamesWithLogos(albumOrder = ALBUM_DISPLAY_ORDER) {
  return albumOrder.filter((name) => getAlbumLogoUrl(name));
}
