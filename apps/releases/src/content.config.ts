import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const releases = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/releases" }),
  schema: z.object({
    repo: z.string(),
    repoDisplayName: z.string(),
    version: z.string(),
    name: z.string().optional(),
    publishedAt: z.coerce.date(),
    url: z.string(),
    prerelease: z.boolean(),
    channel: z.enum(["stable", "edge"]).optional(),
    kind: z.enum(["core", "mod", "tool"]).optional(),
  }),
});

export const collections = { releases };
