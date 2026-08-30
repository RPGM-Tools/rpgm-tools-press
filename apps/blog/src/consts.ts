export const SITE_TITLE = "Relics & Reckonings";
export const SITE_LOGO = "/logo.webp";
export const REPO_URL = "https://github.com/RPGM-Tools/rpgm-tools-press";

export const AUTHOR_NAME = "Aaron Westover";
export const AUTHOR_AVATAR = "/aaron-headshot.webp";
export const SITE_TAGLINE =
  "Notes from the workshop - AI experiments, dev logs, and the occasional dragon.";
export const SITE_DESCRIPTION = SITE_TAGLINE;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Archive", href: "/archive" },
];

/**
 * Per-category label + color, shown as a solid-tinted chip on post cards
 * and the post page itself. Colors are drawn from the same anchor palette
 * as the rest of the suite rather than invented fresh: neo-angband reuses
 * that repo's own accent (see apps/releases/repos.json) so the category
 * carries the same identity there as everywhere else it appears; the other
 * three lean on the theme's existing rust/graphite/forest anchors.
 */
export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  "ai-projects": { label: "AI Projects", color: "#c04100" },
  "neo-angband": { label: "Neo Angband", color: "#8b1a1a" },
  "rpgm-tools": { label: "RPGM Tools", color: "#1f2937" },
  "dev-musings": { label: "Dev Musings", color: "#35513f" },
};

// GitHub Discussions category ID for "Blog Comments" (starts with "DIC_").
// Filled in once that category exists on RPGM-Tools/rpgm-tools-press - a
// placeholder categoryId would make giscus render a visible error instead
// of nothing, so `ready` gates whether pages render the widget at all.
const GISCUS_CATEGORY_ID = "DIC_kwDOUIeO4s4DEfbA";
export const GISCUS = {
  repo: "RPGM-Tools/rpgm-tools-press" as const,
  repoId: "R_kgDOUIeO4g",
  category: "Blog Comments",
  categoryId: GISCUS_CATEGORY_ID,
  ready: !GISCUS_CATEGORY_ID.startsWith("TODO-"),
};
