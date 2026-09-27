import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DRAFTS_DIR } from "./lib/sidecar";

// One folder per draft: <slug>/post.md plus JSON sidecars (see lib/sidecar.ts).
const drafts = defineCollection({
  loader: glob({
    pattern: "*/post.md",
    base: pathToFileURL(path.resolve(DRAFTS_DIR) + path.sep),
    generateId: ({ entry }) => entry.split("/")[0] ?? entry,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { drafts };
