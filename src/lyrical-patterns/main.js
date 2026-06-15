import "../styles/main.css";
import "../styles/nav.css";
import "../styles/lyrical-themes.css";
import "../../sections/lyrical-pattern/src/assets/typography.css";
import "../../sections/lyrical-pattern/src/assets/style.css";

import { initSiteNav } from "../ui/site-nav.js";
import { initLyricalPatterns } from "../../sections/lyrical-pattern/src/index.js";

initSiteNav("lyrical-patterns");
initLyricalPatterns();
