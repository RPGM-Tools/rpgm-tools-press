import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Topic categories live in CATEGORY_META (consts.ts); any other slug still
    // renders, labelled from the slug, so a new topic never breaks the build.
    category: z.string().optional(),
    // Social preview and header image, site-relative (e.g. /covers/<slug>.webp).
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
