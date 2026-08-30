/**
 * @rpgm/tools-press-theme has no JS entry point to import in practice.
 * Astro components (.astro) are not bundled through a JS barrel file -
 * Vite/Astro resolves them directly from source. Import them by their
 * subpath export instead, e.g.:
 *
 *   import Layout from "@rpgm/tools-press-theme/components/Layout.astro";
 *   import EntryCard from "@rpgm/tools-press-theme/components/EntryCard.astro";
 *   import Flourish from "@rpgm/tools-press-theme/ornaments/Flourish.astro";
 *
 * ...and the CSS tokens as plain stylesheet imports:
 *
 *   import "@rpgm/tools-press-theme/tokens/base.css";
 *   import "@rpgm/tools-press-theme/tokens/typography.css";
 *
 * See ../README.md for the full component/export list. This file exists
 * only so the package has a documented, typed entry point for tooling
 * that expects one (and so `main`/`types` fields have somewhere valid to
 * point, if ever needed) - it is not meant to be imported at runtime.
 */
export {};
