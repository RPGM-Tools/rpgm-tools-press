import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const releases = defineCollection({
  // The default id-generation slugifies the path and drops internal dots
  // (v1.3.0.md -> "v130"), which can collide across distinct versions.
  // Strip only the file extension instead, keeping the version dots intact.
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/releases",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    repo: z.string(),
    repoDisplayName: z.string(),
    version: z.string(),
    publishedAt: z.coerce.date(),
    url: z.string(),
    kind: z.enum(["core", "mod", "tool"]).optional(),
    emoji: z.string().optional(),
    /** Per-repo accent color (hex), mirrored from that repo's own discord-announce.mjs REPO_CONFIG so the same identity carries across Discord and the site. */
    color: z.string().optional(),
    /** AI-synthesized 1-2 sentence blurb for list views; falls back to summarize(body) when absent (e.g. the AI call failed at sync time). */
    summary: z.string().optional(),
    assets: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          sizeBytes: z.number(),
        }),
      )
      .default([]),
  }),
});

export const collections = { releases };
