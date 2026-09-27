import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { SITE_TITLE } from "../consts";

// llms.txt (llmstxt.org): a plain index of the posts for AI answer engines.
export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection("posts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
  const url = (path: string) => new URL(path, site).toString();
  const lines = [
    `# ${SITE_TITLE}`,
    "",
    "> Aaron Westover writes here about software engineering, UI/UX design, and working with AI tools, drawn from his own projects.",
    "",
    "## Posts",
    "",
    ...posts.map((p) => `- [${p.data.title}](${url(`/posts/${p.id}/`)}): ${p.data.description}`),
    "",
    "## About",
    "",
    `- [About the author](${url("/about/")})`,
    `- [RSS feed](${url("/rss.xml")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
