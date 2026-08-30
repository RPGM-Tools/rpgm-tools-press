#!/usr/bin/env node
// @ts-check
/**
 * Syncs GitHub Releases for every repo listed in apps/releases/repos.json
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
 * Idempotency: each release's generated frontmatter+body is compared
 * against what's already on disk before writing, so re-running with no
 * new releases produces zero file changes.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REPOS_JSON_PATH = path.join(REPO_ROOT, "apps", "releases", "repos.json");
const OUTPUT_ROOT = path.join(REPO_ROOT, "apps", "releases", "src", "content", "releases");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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

async function fetchAllReleases(owner, repo) {
  const releases = [];
  let url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;

  while (url) {
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status} ${res.statusText} for ${owner}/${repo}: ${body.slice(0, 200)}`);
    }
    const page = await res.json();
    releases.push(...page);
    url = parseNextLink(res.headers.get("link"));
  }

  return releases;
}

/** Sanitizes a tag name for use as a filename component. */
function sanitizeForFilename(tag) {
  return tag.replace(/[\\/:*?"<>|]/g, "-");
}

/** YAML double-quoted scalar - JSON string escaping is a valid subset. */
function yamlString(value) {
  return JSON.stringify(value);
}

function inferChannel(tagName) {
  return tagName.includes("-edge") ? "edge" : "stable";
}

function buildMarkdown(tracked, release) {
  const fullName = `${tracked.owner}/${tracked.repo}`;
  const channel = inferChannel(release.tag_name);
  const body = release.body && release.body.trim().length > 0
    ? release.body
    : "_No release notes provided._";

  const lines = [
    "---",
    `repo: ${yamlString(fullName)}`,
    `repoDisplayName: ${yamlString(tracked.displayName)}`,
    `version: ${yamlString(release.tag_name)}`,
  ];
  if (release.name && release.name.trim().length > 0) {
    lines.push(`name: ${yamlString(release.name)}`);
  }
  lines.push(
    `publishedAt: ${yamlString(release.published_at ?? release.created_at)}`,
    `url: ${yamlString(release.html_url)}`,
    `prerelease: ${release.prerelease ? "true" : "false"}`,
    `channel: ${yamlString(channel)}`,
  );
  if (tracked.kind) {
    lines.push(`kind: ${yamlString(tracked.kind)}`);
  }
  lines.push("---", "", body.trimEnd(), "");

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

async function main() {
  const reposRaw = await readFile(REPOS_JSON_PATH, "utf8");
  /** @type {{owner: string, repo: string, displayName: string, kind?: string}[]} */
  const repos = JSON.parse(reposRaw);

  const summary = {
    reposChecked: 0,
    releasesFound: {},
    filesCreated: 0,
    filesUpdated: 0,
    filesUnchanged: 0,
    errors: [],
  };

  for (const tracked of repos) {
    summary.reposChecked += 1;
    const label = `${tracked.owner}/${tracked.repo}`;

    let releases;
    try {
      releases = await fetchAllReleases(tracked.owner, tracked.repo);
    } catch (err) {
      summary.errors.push(`${label}: ${err.message}`);
      continue;
    }

    summary.releasesFound[label] = releases.length;
    const folder = path.join(OUTPUT_ROOT, `${tracked.owner}-${tracked.repo}`);

    for (const release of releases) {
      const version = sanitizeForFilename(release.tag_name);
      const filePath = path.join(folder, `${version}.md`);
      const content = buildMarkdown(tracked, release);

      try {
        const result = await writeIfChanged(filePath, content);
        if (result === "created") summary.filesCreated += 1;
        else if (result === "updated") summary.filesUpdated += 1;
        else summary.filesUnchanged += 1;
      } catch (err) {
        summary.errors.push(`${label}#${release.tag_name}: ${err.message}`);
      }
    }
  }

  console.log("");
  console.log("=== sync-releases summary ===");
  console.log(`repos checked: ${summary.reposChecked}`);
  for (const [repoLabel, count] of Object.entries(summary.releasesFound)) {
    console.log(`  ${repoLabel}: ${count} release(s)`);
  }
  console.log(`files created: ${summary.filesCreated}`);
  console.log(`files updated: ${summary.filesUpdated}`);
  console.log(`files unchanged: ${summary.filesUnchanged}`);
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
