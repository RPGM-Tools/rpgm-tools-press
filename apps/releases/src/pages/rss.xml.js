import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";
import { summarize } from "../lib/summarize";
import { FAMILIES, familyOf } from "../lib/repos";

/** Shared by the main feed and the per-family feeds in rss/[family].xml.js. */
export async function releaseFeed(context, { title, description, family }) {
  const releases = (await getCollection("releases"))
    .filter((release) => {
      const f = familyOf(release.data.repo);
      return f && (!family || f === family);
    })
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());

  return rss({
    title,
    description,
    site: context.site,
    items: releases.map((release) => ({
      title: `${release.data.repoDisplayName} ${release.data.version}`,
      description: summarize(release.body),
      pubDate: release.data.publishedAt,
      link: `/releases/${release.id}/`,
      categories: [FAMILIES.find((f) => f.id === familyOf(release.data.repo))?.label, release.data.kind].filter(Boolean),
    })),
    customData: `<language>en-us</language>`,
  });
}

export function GET(context) {
  return releaseFeed(context, { title: SITE_TITLE, description: SITE_DESCRIPTION });
}
