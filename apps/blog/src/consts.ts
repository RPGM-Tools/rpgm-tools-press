export const SITE_TITLE = "Relics & Reckonings";
export const SITE_TAGLINE =
  "Notes from the workshop - AI experiments, dev logs, and the occasional dragon.";
export const SITE_DESCRIPTION = SITE_TAGLINE;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Archive", href: "/archive" },
];

// GitHub Discussions category ID for "Blog Comments" (starts with "DIC_").
// Filled in once that category exists on RPGM-Tools/rpgm-tools-press - a
// placeholder categoryId would make giscus render a visible error instead
// of nothing, so `ready` gates whether pages render the widget at all.
const GISCUS_CATEGORY_ID = "TODO-create-Blog-Comments-category";
export const GISCUS = {
  repo: "RPGM-Tools/rpgm-tools-press" as const,
  repoId: "R_kgDOUIeO4g",
  category: "Blog Comments",
  categoryId: GISCUS_CATEGORY_ID,
  ready: !GISCUS_CATEGORY_ID.startsWith("TODO-"),
};
