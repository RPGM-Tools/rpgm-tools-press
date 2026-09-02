// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import remarkChangelogChips from "./src/lib/remark-changelog-chips.ts";

export default defineConfig({
  site: "https://releases.rpgm.tools",
  output: "static",
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkChangelogChips],
  },
});
