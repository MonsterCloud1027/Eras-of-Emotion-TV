import "../styles/main.css";
import "../styles/nav.css";
import "../styles/lyrical-themes.css";

import { DATA_URL } from "../config/constants.js";
import { initSiteNav } from "../ui/site-nav.js";
import { initLyricalThemes } from "../../sections/lyrical-themes/src/index.js";

initSiteNav("lyrical-themes");
initLyricalThemes(DATA_URL);
