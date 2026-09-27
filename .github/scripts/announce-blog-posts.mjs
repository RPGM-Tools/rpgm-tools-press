#!/usr/bin/env node
// @ts-check
/**
 * Opens a post in the Discord #blog forum for each blog post published by a push.
 *
 * Usage: node .github/scripts/announce-blog-posts.mjs <before-sha> <after-sha>
 *        node .github/scripts/announce-blog-posts.mjs --file apps/blog/src/content/posts/<name>.md
 *
 * Env: DISCORD_BLOG_WEBHOOK_URL (the #blog forum webhook). DRY_RUN=1 prints the payloads instead of sending them.
 *
 * A post counts as published when its file is added with `draft: false`, or when an existing file goes from `draft: true` to `draft: false`.
 * The forum post is sent silent, so nobody gets a push or desktop notification for it. A reply in its thread then mentions the Blog News role, and thread replies only notify members who are mentioned or already following the thread.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const POSTS_DIR = "apps/blog/src/content/posts/";
const SITE = "https://blog.rpgm.tools";
const BLOG_NEWS_ROLE_ID = "1553725178150785065";
const FORUM_TAGS = {
  "ai-projects": "1553723453419430029",
  "neo-angband": "1553723538119327834",
  "rpgm-tools": "1553723548353433710",
  "dev-musings": "1553723558566305862",
};
const SUPPRESS_NOTIFICATIONS = 1 << 12;
const USER_AGENT = "DiscordBot (https://github.com/RPGM-Tools/rpgm-tools-press, 1.0)";
const FEED_ATTEMPTS = 12;
const FEED_DELAY_MS = 10_000;

/** @param {string[]} args */
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** @param {string} rev @param {string} path */
function readAt(rev, path) {
  try {
    return git("show", `${rev}:${path}`);
  } catch {
    return null;
  }
}

/** @param {string | null} text */
function frontmatter(text) {
  const match = text?.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  /** @type {Record<string, string>} */
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^".*"$/.test(value)) value = JSON.parse(value);
    else if (/^'.*'$/.test(value)) value = value.slice(1, -1).replace(/''/g, "'");
    data[kv[1]] = value;
  }
  return data;
}

/** @param {Record<string, string> | null} data */
const isPublished = (data) => data !== null && data.draft !== "true";

/** @param {string} before @param {string} after */
function publishedByPush(before, after) {
  const changed = git("diff", "--name-only", "--diff-filter=AMR", before, after, "--", POSTS_DIR)
    .split("\n")
    .filter((path) => path.endsWith(".md"));
  return changed.flatMap((path) => {
    const now = frontmatter(readAt(after, path));
    const then = frontmatter(readAt(before, path));
    return isPublished(now) && !isPublished(then) ? [{ path, data: now }] : [];
  });
}

/** @param {string} s */
function unescapeXml(s) {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** The deployed feed is the source of each post's real URL, so the slug rules stay Astro's alone. @param {string} title */
async function liveLink(title) {
  const attempts = process.env.DRY_RUN ? 1 : FEED_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(`${SITE}/rss.xml`, { headers: { "Cache-Control": "no-cache" } });
    if (res.ok) {
      const xml = await res.text();
      for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const itemTitle = item[1].match(/<title>([\s\S]*?)<\/title>/)?.[1];
        const link = item[1].match(/<link>([\s\S]*?)<\/link>/)?.[1];
        if (itemTitle && link && unescapeXml(itemTitle).trim() === title.trim()) {
          const page = await fetch(unescapeXml(link), { method: "HEAD" });
          if (page.ok) return unescapeXml(link);
        }
      }
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, FEED_DELAY_MS));
  }
  if (process.env.DRY_RUN) return `${SITE}/posts/not-live-yet/`;
  throw new Error(`"${title}" is not live on ${SITE}/rss.xml yet`);
}

/** @param {string} url @param {object} payload */
async function send(url, payload) {
  if (process.env.DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    return { id: "dry-run" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord returned ${res.status}: ${await res.text()}`);
  return res.json();
}

/** @param {{ path: string, data: Record<string, string> }} post */
async function announce({ path, data }) {
  if (!data.title) throw new Error(`${path} has no title`);
  const link = await liveLink(data.title);
  const webhook = process.env.DISCORD_BLOG_WEBHOOK_URL ?? "";
  if (!webhook && !process.env.DRY_RUN) throw new Error("DISCORD_BLOG_WEBHOOK_URL is not set");
  const tag = FORUM_TAGS[/** @type {keyof typeof FORUM_TAGS} */ (data.category)];

  const thread = await send(`${webhook}?wait=true`, {
    thread_name: data.title.slice(0, 100),
    content: [data.description, link].filter(Boolean).join("\n\n"),
    applied_tags: tag ? [tag] : [],
    flags: SUPPRESS_NOTIFICATIONS,
    allowed_mentions: { parse: [] },
  });
  await send(`${webhook}?thread_id=${thread.channel_id ?? thread.id}`, {
    content: `<@&${BLOG_NEWS_ROLE_ID}> New post: **${data.title}**`,
    allowed_mentions: { roles: [BLOG_NEWS_ROLE_ID] },
  });
  console.log(`Announced "${data.title}" (${link})`);
}

const args = process.argv.slice(2);
/** @type {{ path: string, data: Record<string, string> }[]} */
let posts;
if (args[0] === "--file") {
  const data = frontmatter(readFileSync(args[1], "utf8"));
  if (!isPublished(data)) throw new Error(`${args[1]} is a draft or has no frontmatter`);
  posts = [{ path: args[1], data: /** @type {Record<string, string>} */ (data) }];
} else if (args.length === 2 && !/^0+$/.test(args[0])) {
  posts = publishedByPush(args[0], args[1]);
} else {
  console.log("No before/after range to compare, so nothing to announce.");
  posts = [];
}

if (posts.length === 0) console.log("No newly published posts.");
for (const post of posts) await announce(post);
