/**
 * The view-transition-name shared by a list entry and its detail page's
 * heading, so the title morphs between the two on navigation. Names must
 * be CSS identifiers and unique on a page, so the entry's id is reduced
 * to letters, digits and hyphens.
 */
export function transitionName(id: string): string {
  return `rpgm-vt-${id.replace(/[^a-zA-Z0-9-]+/g, "-")}`;
}
