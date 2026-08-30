// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://releases.rpgm.tools",
  output: "static",
  integrations: [sitemap()],
});
