/** Mutable app state shared across viz modules */

export const appState = {
  allSongs: [],
  /** @type {Map<string, object[]>|null} */
  sectionsBySong: null,
  sectionWheelBySong: null,
  sectionTypeColorScale: null,
  /** @type {object|null} Active song in section drill-down view */
  drilldownSong: null,
  albumColorScale: null,
  selectedAlbumHighlight: null,
  hoverAlbum: null,
  hoveredSongId: null,
  /** Album dominant after scrolling past global (drives idle glow). */
  scrollFocusAlbum: null,
  albumOrder: [],
  albumScrollIndex: null,
  overviewLayers: null,
};
