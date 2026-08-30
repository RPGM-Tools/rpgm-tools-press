import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";
import { summarize } from "../lib/summarize";

export async function GET(context) {
  const releases = await getCollection("releases");
  const sorted = releases.sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: sorted.map((release) => ({
      title: `${release.data.repoDisplayName} ${release.data.version}`,
      description: summarize(release.body),
      pubDate: release.data.publishedAt,
      link: `/releases/${release.id}/`,
      categories: release.data.kind ? [release.data.kind] : [],
    })),
    customData: `<language>en-us</language>`,
  });
}
