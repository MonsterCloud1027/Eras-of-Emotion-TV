import "../styles/main.css";
import "../styles/nav.css";
import "../styles/lyrical-themes.css";

import { PROCESSED_LYRICAL_THEMES_URL } from "../config/constants.js";
import { initSiteNav } from "../ui/site-nav.js";
import { initLyricalThemes } from "../../sections/lyrical-themes/src/index.js";

initSiteNav("lyrical-themes");
initLyricalThemes(PROCESSED_LYRICAL_THEMES_URL);
