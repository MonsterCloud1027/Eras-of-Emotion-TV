/**
 * Site-wide navigation between visualizations.
 */

export const NAV_ITEMS = [
  {
    id: "galaxy",
    label: "Emotion Galaxy",
    shortLabel: "Galaxy",
    description: "Radial Plutchik wheel",
    href: "index",
  },
  {
    id: "lyrical-themes",
    label: "Lyrical Themes",
    shortLabel: "Themes",
    description: "Album emotion treemap",
    href: "lyrical-themes.html",
  },
    {
    id: "lyrical-patterns",
    label: "Lyrical Patterns",
    shortLabel: "Patterns",
    description: "Album emotion patterns",
    href: "lyrical-patterns.html",
  },
  {
    id: "other-vis-1",
    label: "Lyrical Complexity",
    shortLabel: "Complexity",
    description: "CEFR vocabulary across albums",
    href: "lyrical-complexity.html",
  },
  {
    id: "other-vis-2",
    label: "Song Structure",
    shortLabel: "Structure",
    description: "Section DNA strips by style",
    href: "song-structure.html",
  },
];

function navHref(href) {
  const base = import.meta.env.BASE_URL;
  if (href === "index") return base;
  return `${base}${href}`;
}

function renderNavItem(item, activeId) {
  const label = `
    <span class="site-nav__link-label">${item.label}</span>
    <span class="site-nav__link-short">${item.shortLabel}</span>`;

  if (item.placeholder) {
    return `
      <span class="site-nav__link">
        ${label}
      </span>`;
  }

  const isActive = item.id === activeId;
  return `
    <a
      class="site-nav__link${isActive ? " is-active" : ""}"
      href="${navHref(item.href)}"
      aria-current="${isActive ? "page" : "false"}"
      title="${item.description}"
    >
      ${label}
    </a>`;
}

/**
 * Renders the site navigation bar and marks the active visualization.
 *
 * @param {string} activeId Current page id
 */
export function initSiteNav(activeId) {
  const mount = document.getElementById("site-nav");
  if (!mount) return;

  const brandHref = import.meta.env.BASE_URL;

  mount.innerHTML = `
    <div class="site-nav__inner">
      <a class="site-nav__brand" href="${brandHref}">
        <span class="site-nav__brand-eyebrow">Eras of Emotion</span>
        <span class="site-nav__brand-title">Taylor's Version</span>
      </a>
      <div class="site-nav__links" role="navigation" aria-label="Visualizations">
        ${NAV_ITEMS.map((item) => renderNavItem(item, activeId)).join("")}
      </div>
    </div>
  `;
}
