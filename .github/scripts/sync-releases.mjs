#!/usr/bin/env node
// @ts-check
/**
 * Syncs release notes for every repo listed in apps/releases/repos.json
 * into apps/releases/src/content/releases/<owner>-<repo>/<tag>.md content
 * collection entries.
 *
 * Usage: node .github/scripts/sync-releases.mjs
 * (run from anywhere - all paths below are resolved relative to this
 * script's own location, not the caller's cwd, so it behaves the same in
 * CI as it does from a human's shell)
 *
 * Auth: uses GITHUB_TOKEN from the environment if set (Authorization:
 * Bearer <token>). Works unauthenticated too, just at GitHub's much lower
 * unauthenticated rate limit - fine for local/manual runs, a real token
 * should be supplied in CI.
 *
 * Only a strict `vX.Y.Z` tag is synced, for every repo alike - GitHub's own
 * `prerelease` flag is NOT used as the filter, because it marks every
 * pre-1.0 version true as well as genuine rolling/edge builds (tagged
 * `vX.Y.Z-edge.N`), and pre-1.0 history is real release history, not noise.
 * The tag pattern alone already excludes edge builds and anything not
 * meant as a real version.
 *
 * A repo that has ANY formal GitHub Releases (currently just the core game)
 * is read from the Releases API, so its ~1,400 inherited upstream Angband
 * tags never enter the picture. A repo with NO formal Releases (currently
 * every mod - a version tag IS the release for them, see each mod's own
 * discord-announce.yml) is read from its tags instead. Either source is
 * then filtered to the same strict vX.Y.Z pattern.
 *
 * Either way, the actual release-notes content comes from that version's
 * own section of CHANGELOG.md at that tag - never a GitHub Release's own
 * `body`, which (for the core game) is assembled at release time from a
 * download-instructions preamble + the changelog + a footer, none of which
 * belongs in an aggregator reader's hands except the changelog itself.
 *
 * Idempotency: each release's generated frontmatter+body is compared
 * against what's already on disk before writing, so re-running with no
 * new releases produces zero file changes. Stale files (a tag that no
 * longer qualifies - e.g. it was an edge build) are deleted.
 *
 * Each entry also gets a short AI-synthesized summary (MiniMax-M3, needs
 * MINIMAX_API_KEY) of its changelog section for list-view cards - generated
 * once and cached in frontmatter, since a tag's own content never changes.
 * Missing key or a failed call just skips the field; the page falls back to
 * a plain truncation at render time (see apps/releases/src/lib/summarize.ts).
 */

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REPOS_JSON_PATH = path.join(REPO_ROOT, "apps", "releases", "repos.json");
const OUTPUT_ROOT = path.join(REPO_ROOT, "apps", "releases", "src", "content", "releases");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const STABLE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

function ghHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rpgm-tools-press-releases-sync",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

/** Parses a `Link` response header for a `rel="next"` URL, or null. */
function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function fetchAllPages(firstUrl) {
  const items = [];
  let url = firstUrl;
  while (url) {
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 200)}`);
    }
    const page = await res.json();
    items.push(...page);
    url = parseNextLink(res.headers.get("link"));
  }
  return items;
}

function fetchAllReleases(owner, repo) {
  return fetchAllPages(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`);
}

function fetchAllTags(owner, repo) {
  return fetchAllPages(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`);
}

/** CHANGELOG.md's content at a given ref, or null if the file doesn't exist there. */
async function fetchChangelogAt(owner, repo, ref) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/CHANGELOG.md?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText} fetching CHANGELOG.md@${ref} for ${owner}/${repo}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return Buffer.from(json.content, "base64").toString("utf8");
}

/** The commit date a tag ref points at, used when a changelog heading has no date of its own. */
async function fetchRefDate(owner, repo, ref) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText} fetching commit@${ref} for ${owner}/${repo}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.commit?.committer?.date ?? json.commit?.author?.date ?? null;
}

/**
 * The lines under `## [<version>]` or `## <version>`, up to the next `## `,
 * plus that heading's own trailing date if it has one ("## [1.3.0] - 2026-08-29").
 * Ported from each repo's own discord-announce.mjs, which extracts the same
 * section for its Discord post - kept in sync by hand, not by import,
 * matching that script's own precedent of being duplicated per repo.
 */
function changelogSection(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const heading = new RegExp(`^##\\s+\\[?${version.replace(/\./g, "\\.")}\\]?(\\s|$)`);
  let start = -1;
  let headingLine = "";
  for (let i = 0; i < lines.length; i++) {
    if (heading.test(lines[i])) {
      headingLine = lines[i];
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const dateMatch = headingLine.match(/-\s*(\d{4}-\d{2}-\d{2})/);
  return {
    body: lines.slice(start, end).join("\n").trim(),
    date: dateMatch ? dateMatch[1] : null,
  };
}

/** Sanitizes a tag name for use as a filename component. */
function sanitizeForFilename(tag) {
  return tag.replace(/[\\/:*?"<>|]/g, "-");
}

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/chat/completions";

/**
 * A short (<=2 sentence) AI-synthesized summary of a release's changelog
 * section, for the one-line blurb on a release-listing card - the previous
 * approach (the raw first bullet, truncated) was often a fragment of one
 * detail rather than an overview of the release. Returns null (never
 * throws) on a missing key, a failed call, or an empty response, so a
 * caller can fall back to the old truncation - one bad/rate-limited call
 * degrades one card, not the whole sync run.
 */
async function summarizeWithAI(changelogBody, { repoDisplayName, version }) {
  if (!MINIMAX_API_KEY || !changelogBody) return null;

  const prompt = [
    `Summarize the following changelog section for "${repoDisplayName} ${version}" in at most two short sentences, plain prose, no markdown formatting.`,
    "Write for someone browsing a list of release notes across several repositories - focus on what a player or user would actually notice.",
    "",
    changelogBody,
  ].join("\n");

  try {
    const res = await fetch(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-M3",
        messages: [{ role: "user", content: prompt }],
        // Generous headroom: MiniMax-M3 is a reasoning model that spends
        // part of this budget on its own <think> trace before the answer,
        // and a long changelog section needs more of it to reason through.
        max_completion_tokens: 900,
      }),
    });
    if (!res.ok) {
      console.warn(`MiniMax summarize failed (${res.status}) for ${repoDisplayName} ${version}, falling back to truncation`);
      return null;
    }
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "";
    // If a <think> tag opens but max_completion_tokens ran out before it
    // closed, the response was cut off mid-reasoning with no real answer
    // at all - treat that as a failure rather than let raw chain-of-thought
    // leak through as the "summary".
    if (/<think>/i.test(raw) && !/<\/think>/i.test(raw)) {
      console.warn(`MiniMax summarize truncated mid-reasoning for ${repoDisplayName} ${version}, falling back to truncation`);
      return null;
    }
    const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.warn(`MiniMax summarize errored for ${repoDisplayName} ${version}: ${err.message}, falling back to truncation`);
    return null;
  }
}

/** The `summary:` frontmatter value already on disk for this entry, if any - reused as-is rather than re-calling the AI summarizer for a tag whose content can never change (it's an immutable git ref). */
async function existingSummary(filePath) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const match = content.match(/^summary:\s*(".*")\s*$/m);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** YAML double-quoted scalar - JSON string escaping is a valid subset. */
function yamlString(value) {
  return JSON.stringify(value);
}

function buildMarkdown(tracked, entry) {
  const fullName = `${tracked.owner}/${tracked.repo}`;
  const lines = [
    "---",
    `repo: ${yamlString(fullName)}`,
    `repoDisplayName: ${yamlString(tracked.displayName)}`,
    `version: ${yamlString(entry.tag)}`,
    `publishedAt: ${yamlString(entry.publishedAt)}`,
    `url: ${yamlString(entry.url)}`,
  ];
  if (tracked.kind) lines.push(`kind: ${yamlString(tracked.kind)}`);
  if (tracked.emoji) lines.push(`emoji: ${yamlString(tracked.emoji)}`);
  if (entry.summary) lines.push(`summary: ${yamlString(entry.summary)}`);
  if (entry.assets.length > 0) {
    lines.push(`assets: ${JSON.stringify(entry.assets)}`);
  }
  lines.push("---", "", entry.body.trim(), "");
  return lines.join("\n");
}

async function writeIfChanged(filePath, content) {
  let existing = null;
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    // File doesn't exist yet - that's fine, we'll write it.
  }

  if (existing === content) {
    return "unchanged";
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return existing === null ? "created" : "updated";
}

/** Deletes any .md file in `folder` whose name isn't in `keepFilenames`. */
async function pruneStaleFiles(folder, keepFilenames) {
  let existingFiles;
  try {
    existingFiles = await readdir(folder);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const file of existingFiles) {
    if (file.endsWith(".md") && !keepFilenames.has(file)) {
      await unlink(path.join(folder, file));
      removed += 1;
    }
  }
  return removed;
}

/** Builds one synced entry (changelog section + metadata) for a single stable version tag. */
async function buildEntryForTag(tracked, tag, { fallbackBody, fallbackPublishedAt, assets, url }) {
  const version = tag.replace(/^v/, "");
  const changelog = await fetchChangelogAt(tracked.owner, tracked.repo, tag);
  const section = changelog ? changelogSection(changelog, version) : null;

  const body = section?.body || fallbackBody;
  if (!body) return null;

  // Prefer a real timestamp (release publish time, or the tag's commit time)
  // over the changelog heading's own date, which is day-precision only - two
  // releases on the same calendar day would otherwise get an identical
  // publishedAt and sort against each other in whatever order the content
  // loader happened to read files off disk, not official publish order.
  const publishedAt = fallbackPublishedAt ?? (await fetchRefDate(tracked.owner, tracked.repo, tag)) ?? section?.date;

  return {
    tag,
    body,
    publishedAt,
    url,
    assets,
  };
}

async function main() {
  const reposRaw = await readFile(REPOS_JSON_PATH, "utf8");
  /** @type {{owner: string, repo: string, displayName: string, kind?: string, emoji?: string}[]} */
  const repos = JSON.parse(reposRaw);

  const summary = {
    reposChecked: 0,
    entriesFound: {},
    filesCreated: 0,
    filesUpdated: 0,
    filesUnchanged: 0,
    filesRemoved: 0,
    skipped: [],
    errors: [],
  };

  for (const tracked of repos) {
    summary.reposChecked += 1;
    const label = `${tracked.owner}/${tracked.repo}`;
    const folder = path.join(OUTPUT_ROOT, `${tracked.owner}-${tracked.repo}`);

    let entries = [];
    try {
      const allReleases = await fetchAllReleases(tracked.owner, tracked.repo);

      if (allReleases.length > 0) {
        const stable = allReleases.filter((r) => STABLE_TAG_PATTERN.test(r.tag_name));
        for (const release of stable) {
          const fallbackBody = release.body && release.body.trim().length > 0 ? release.body.replace(/\r\n?/g, "\n") : null;
          const entry = await buildEntryForTag(tracked, release.tag_name, {
            fallbackBody,
            fallbackPublishedAt: release.published_at ?? release.created_at,
            assets: (release.assets ?? []).map((a) => ({
              name: a.name,
              url: a.browser_download_url,
              sizeBytes: a.size,
            })),
            url: release.html_url,
          });
          if (entry) entries.push(entry);
          else summary.skipped.push(`${label}#${release.tag_name}: no CHANGELOG.md section and no release body`);
        }
      } else {
        const tags = await fetchAllTags(tracked.owner, tracked.repo);
        const stableTags = tags.filter((t) => STABLE_TAG_PATTERN.test(t.name));
        for (const tag of stableTags) {
          const entry = await buildEntryForTag(tracked, tag.name, {
            fallbackBody: null,
            fallbackPublishedAt: null,
            assets: [],
            url: `https://github.com/${tracked.owner}/${tracked.repo}/releases/tag/${tag.name}`,
          });
          if (entry) entries.push(entry);
          else summary.skipped.push(`${label}#${tag.name}: no CHANGELOG.md section found`);
        }
      }
    } catch (err) {
      summary.errors.push(`${label}: ${err.message}`);
      continue;
    }

    summary.entriesFound[label] = entries.length;

    const keepFilenames = new Set(entries.map((e) => `${sanitizeForFilename(e.tag)}.md`));
    try {
      const removed = await pruneStaleFiles(folder, keepFilenames);
      summary.filesRemoved += removed;
    } catch (err) {
      summary.errors.push(`${label}: pruning stale files failed: ${err.message}`);
    }

    for (const entry of entries) {
      const filePath = path.join(folder, `${sanitizeForFilename(entry.tag)}.md`);
      // Reuse an already-synced entry's summary as-is (its source tag is an
      // immutable git ref, so the changelog section it was built from can
      // never change) - only a genuinely new entry pays for an AI call.
      entry.summary = (await existingSummary(filePath)) ?? (await summarizeWithAI(entry.body, { repoDisplayName: tracked.displayName, version: entry.tag }));
      const content = buildMarkdown(tracked, entry);
      try {
        const result = await writeIfChanged(filePath, content);
        if (result === "created") summary.filesCreated += 1;
        else if (result === "updated") summary.filesUpdated += 1;
        else summary.filesUnchanged += 1;
      } catch (err) {
        summary.errors.push(`${label}#${entry.tag}: ${err.message}`);
      }
    }
  }

  console.log("");
  console.log("=== sync-releases summary ===");
  console.log(`repos checked: ${summary.reposChecked}`);
  for (const [repoLabel, count] of Object.entries(summary.entriesFound)) {
    console.log(`  ${repoLabel}: ${count} entr${count === 1 ? "y" : "ies"}`);
  }
  console.log(`files created: ${summary.filesCreated}`);
  console.log(`files updated: ${summary.filesUpdated}`);
  console.log(`files unchanged: ${summary.filesUnchanged}`);
  console.log(`files removed (no longer qualify): ${summary.filesRemoved}`);
  if (summary.skipped.length > 0) {
    console.log(`skipped (${summary.skipped.length}):`);
    for (const s of summary.skipped) console.log(`  - ${s}`);
  }
  if (summary.errors.length > 0) {
    console.log(`errors (${summary.errors.length}):`);
    for (const err of summary.errors) console.log(`  - ${err}`);
  } else {
    console.log("errors: none");
  }
}

main().catch((err) => {
  console.error("sync-releases failed:", err);
  process.exitCode = 1;
});
