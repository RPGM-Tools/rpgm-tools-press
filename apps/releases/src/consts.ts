export const SITE_TITLE = "The Ledger";
export const SITE_TAGLINE =
  "Release notes from across the workshop's public repos, gathered in one place.";
export const SITE_DESCRIPTION = SITE_TAGLINE;

export const NAV_LINKS = [{ label: "Home", href: "/" }];

// GitHub Discussions category ID for "Release Discussion" (starts with "DIC_").
// Filled in once that category exists on RPGM-Tools/rpgm-tools-press - a
// placeholder categoryId would make giscus render a visible error instead
// of nothing, so `ready` gates whether pages render the widget at all.
const GISCUS_CATEGORY_ID = "TODO-create-Release-Discussion-category";
export const GISCUS = {
  repo: "RPGM-Tools/rpgm-tools-press" as const,
  repoId: "R_kgDOUIeO4g",
  category: "Release Discussion",
  categoryId: GISCUS_CATEGORY_ID,
  ready: !GISCUS_CATEGORY_ID.startsWith("TODO-"),
};
