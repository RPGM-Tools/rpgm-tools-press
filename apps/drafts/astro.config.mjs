// @ts-check
import { defineConfig } from "astro/config";

// Draft content never lives in this repo. The build reads it from DRAFTS_DIR,
// a private folder on the machine that deploys this site; with it unset the
// site builds with an empty queue.
export default defineConfig({
  site: "https://drafts.blog.rpgm.tools",
  output: "static",
  // Reuse the blog's logo, headshot and fonts so a draft looks exactly like
  // the published post will.
  publicDir: "../blog/public",
});
