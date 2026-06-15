/**
 * Taylor Swift Lyrics Emotion Galaxy — entry
 */
import "./styles/main.css";
import "./styles/nav.css";

import * as d3 from "d3";
import { initSiteNav } from "./ui/site-nav.js";
import { loadSectionWheelBySong } from "./data/section-wheel.js";
import { loadSectionsBySong } from "./data/sections.js";
import { buildSectionTypeColorScale } from "./config/section-type-colors.js";
import {
  buildAlbumColorScale,
  groupSongsByAlbum,
  loadData,
  pickRepresentativeSongForGlobal,
} from "./data/songs.js";
import { appState } from "./state/app-state.js";
import { drawAlbumLegend } from "./ui/legend.js";
import { updateDetailPanel } from "./ui/panel.js";
import {
  buildCoverLayers,
  buildScrollTrack,
  initScrollController,
} from "./ui/scroll-controller.js";
import { initSongDrilldown } from "./viz/song-drilldown.js";
import { drawScrollGalaxy } from "./viz/scroll-galaxy.js";

async function init() {
  initSiteNav("galaxy");

  try {
    const [songs, sectionsBySong, sectionWheelBySong] = await Promise.all([
      loadData(),
      loadSectionsBySong(),
      loadSectionWheelBySong(),
    ]);
    appState.allSongs = songs;
    appState.sectionsBySong = sectionsBySong;
    appState.sectionWheelBySong = sectionWheelBySong;
    appState.sectionTypeColorScale = buildSectionTypeColorScale();
    buildAlbumColorScale(appState.allSongs);
    const grouped = groupSongsByAlbum(appState.allSongs);

    drawScrollGalaxy(appState.allSongs);
    drawAlbumLegend(grouped);

    const { albumOrder } = buildScrollTrack(appState.allSongs);
    buildCoverLayers(albumOrder);
    initScrollController();
    initSongDrilldown();

    if (appState.allSongs.length) {
      updateDetailPanel(pickRepresentativeSongForGlobal(appState.allSongs));
    }
  } catch (err) {
    console.error(err);
    d3.select("#overview-viz").html(
      `<p class="error">Failed to load data: ${err.message}. ` +
        `Run <code>npm install</code> then <code>npm run dev</code>.</p>`
    );
  }
}

init();
