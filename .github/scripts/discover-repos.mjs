#!/usr/bin/env node
// @ts-check
/**
 * Lists the public repos in the neostryder account and the RPGM-Tools org and
 * writes the ones with no decision yet to apps/releases/public/enrollment.json,
 * served at https://releases.rpgm.tools/enrollment.json. The Discord bot reads
 * that file and asks the maintainer about each candidate; the answer comes back
 * through enroll-repo.yml, which records it in repos.json.
 *
 * Usage: node .github/scripts/discover-repos.mjs
 * Env: GITHUB_TOKEN (optional, raises the rate limit).
 *
 * Archived repos and forks are never candidates. A repo already in repos.json,
 * enrolled or declined, is never offered again.
 *
 * Suggested family:
 *   neostryder/neo-angband and neostryder/neo-angband-*  -> neo-angband
 *   RPGM-Tools/rpgm-*                                    -> rpgm-tools, and only
 *                                                           once it has a stable
 *                                                           tag at v1.0.0 or later
 *   everything else                                      -> other-projects
 *
 * Each candidate keeps the discoveredAt it was first written with, so the file
 * only changes when the candidate list or a latest tag changes.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REPOS_JSON_PATH = path.join(REPO_ROOT, "apps", "releases", "repos.json");
const ENROLLMENT_PATH = path.join(REPO_ROOT, "apps", "releases", "public", "enrollment.json");

const OWNERS = [
  { login: "neostryder", listUrl: "https://api.github.com/users/neostryder/repos?type=owner&per_page=100" },
  { login: "RPGM-Tools", listUrl: "https://api.github.com/orgs/RPGM-Tools/repos?type=public&per_page=100" },
];
const STABLE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function ghHeaders() {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rpgm-tools-press-repo-discovery",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

/** @param {string} firstUrl */
async function fetchAllPages(firstUrl) {
  const items = [];
  /** @type {string | null} */
  let url = firstUrl;
  while (url) {
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
    items.push(...(await res.json()));
    const next = res.headers.get("link")?.match(/<([^>]+)>\s*;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return items;
}

/** The highest stable vX.Y.Z tag, or null. @param {string} fullName */
async function latestStableTag(fullName) {
  const tags = await fetchAllPages(`https://api.github.com/repos/${fullName}/tags?per_page=100`);
  /** @type {{name: string, key: number[]} | null} */
  let best = null;
  for (const { name } of tags) {
    const m = name.match(STABLE_TAG_PATTERN);
    if (!m) continue;
    const key = m.slice(1).map(Number);
    const cmp = best ? key[0] - best.key[0] || key[1] - best.key[1] || key[2] - best.key[2] : 1;
    if (cmp > 0) best = { name, key };
  }
  return best?.name ?? null;
}

/** @param {string} owner @param {string} name @param {string | null} latestTag */
function suggestFamily(owner, name, latestTag) {
  if (owner.toLowerCase() === "neostryder" && (name === "neo-angband" || name.startsWith("neo-angband-"))) return "neo-angband";
  if (owner.toLowerCase() === "rpgm-tools" && name.startsWith("rpgm-")) {
    const major = latestTag ? Number(latestTag.match(STABLE_TAG_PATTERN)?.[1]) : 0;
    return major >= 1 ? "rpgm-tools" : null;
  }
  return "other-projects";
}

async function main() {
  /** @type {{owner: string, repo: string}[]} */
  const decided = JSON.parse(await readFile(REPOS_JSON_PATH, "utf8"));
  const decidedKeys = new Set(decided.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));

  /** @type {{repo: string, discoveredAt: string}[]} */
  let previous = [];
  try {
    previous = JSON.parse(await readFile(ENROLLMENT_PATH, "utf8"));
  } catch {
    // First run, or the file was removed: every candidate is new.
  }
  const firstSeen = new Map(previous.map((c) => [c.repo.toLowerCase(), c.discoveredAt]));
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const candidates = [];
  for (const owner of OWNERS) {
    const listed = await fetchAllPages(owner.listUrl);
    for (const r of listed) {
      if (r.private || r.archived || r.fork) continue;
      const fullName = r.full_name;
      if (decidedKeys.has(fullName.toLowerCase())) continue;
      const latestTag = await latestStableTag(fullName);
      const suggestedFamily = suggestFamily(r.owner.login, r.name, latestTag);
      if (!suggestedFamily) continue;
      candidates.push({
        owner: r.owner.login,
        repo: fullName,
        url: r.html_url,
        description: r.description ?? "",
        suggestedFamily,
        latestTag,
        discoveredAt: firstSeen.get(fullName.toLowerCase()) ?? now,
      });
    }
  }
  candidates.sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt) || a.repo.localeCompare(b.repo));

  const content = `${JSON.stringify(candidates, null, 2)}\n`;
  let existing = null;
  try {
    existing = await readFile(ENROLLMENT_PATH, "utf8");
  } catch {
    // Not written yet.
  }
  if (existing !== content) await writeFile(ENROLLMENT_PATH, content, "utf8");

  console.log(`=== discover-repos: ${candidates.length} candidate(s) awaiting a decision ===`);
  for (const c of candidates) console.log(`  ${c.repo} -> ${c.suggestedFamily} (latest ${c.latestTag ?? "none"})`);
}

main().catch((err) => {
  console.error("discover-repos failed:", err);
  process.exitCode = 1;
});
