#!/usr/bin/env node
// @ts-check
/**
 * Records an enrollment decision for one repo in apps/releases/repos.json and
 * drops it from apps/releases/public/enrollment.json. Run by enroll-repo.yml,
 * which the Discord bot dispatches with the maintainer's answer.
 *
 * Usage: node .github/scripts/enroll-repo.mjs <owner/name> <enroll|decline> <family>
 * Env: GITHUB_TOKEN (optional, raises the rate limit).
 *
 * Enrolling writes a starter entry: a display name built from the repo name,
 * the family's default emoji and color, `releases` as the source when the repo
 * has any GitHub Releases and `tags` otherwise, and `enrolledAt` set to now so
 * the announcer never posts a release older than the enrollment. Edit the entry
 * in repos.json afterwards to set a better name, emoji or color.
 *
 * A decision can be changed by running it again: declining an enrolled repo
 * takes it off the site, and enrolling a declined one puts it on.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REPOS_JSON_PATH = path.join(REPO_ROOT, "apps", "releases", "repos.json");
const ENROLLMENT_PATH = path.join(REPO_ROOT, "apps", "releases", "public", "enrollment.json");

const OWNERS = ["neostryder", "rpgm-tools"];
const FAMILY_DEFAULTS = {
  "neo-angband": { prefix: "Neo Angband: ", emoji: "🗡️", color: "#8b1a1a" },
  "rpgm-tools": { prefix: "RPGM Tools: ", emoji: "🎲", color: "#6c3fa8" },
  "other-projects": { prefix: "", emoji: "📦", color: "#546e7a" },
};
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function ghHeaders() {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rpgm-tools-press-enroll",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

/** @param {string} url */
async function getJson(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** "neo-angband-mod-bug-fixes" -> "Bug Fixes", "augur" -> "Augur". @param {string} name */
function titleFromRepoName(name) {
  const stripped = name.replace(/^neo-angband-mod-/, "").replace(/^rpgm-/, "");
  return stripped
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** @param {string} name */
function kindFor(name) {
  if (name === "neo-angband") return "core";
  if (name.startsWith("neo-angband-mod-")) return "mod";
  return "tool";
}

/** Same layout as the hand-edited file: one entry per line. @param {object[]} entries */
function formatRepos(entries) {
  const line = (e) =>
    "  { " +
    Object.entries(e)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ") +
    " }";
  return `[\n${entries.map(line).join(",\n")}\n]\n`;
}

async function main() {
  const [fullNameArg, decision, family] = process.argv.slice(2);
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullNameArg?.trim() ?? "") || !["enroll", "decline"].includes(decision ?? "") || !(family in FAMILY_DEFAULTS)) {
    throw new Error("usage: enroll-repo.mjs <owner/name> <enroll|decline> <neo-angband|rpgm-tools|other-projects>");
  }

  const info = await getJson(`https://api.github.com/repos/${fullNameArg.trim()}`);
  if (!OWNERS.includes(info.owner.login.toLowerCase())) throw new Error(`${info.full_name} is not in neostryder or RPGM-Tools`);
  if (info.private) throw new Error(`${info.full_name} is private`);
  const owner = info.owner.login;
  const repo = info.name;

  /** @type {Record<string, any>[]} */
  const entries = JSON.parse(await readFile(REPOS_JSON_PATH, "utf8"));
  const index = entries.findIndex((e) => `${e.owner}/${e.repo}`.toLowerCase() === info.full_name.toLowerCase());
  const existing = index >= 0 ? entries[index] : null;

  let next;
  if (decision === "decline") {
    next = { owner, repo, status: "declined" };
  } else if (existing?.status === "enrolled") {
    next = { ...existing, family };
  } else {
    const defaults = FAMILY_DEFAULTS[/** @type {keyof typeof FAMILY_DEFAULTS} */ (family)];
    const releases = await getJson(`https://api.github.com/repos/${info.full_name}/releases?per_page=1`);
    const kind = kindFor(repo);
    next = {
      owner,
      repo,
      displayName: kind === "core" ? "Neo Angband" : `${defaults.prefix}${titleFromRepoName(repo)}`,
      family,
      status: "enrolled",
      enrolledAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      kind,
      releaseSource: releases.length > 0 ? "releases" : "tags",
      emoji: defaults.emoji,
      color: defaults.color,
    };
  }

  if (index >= 0) entries[index] = next;
  else entries.push(next);
  // Enrolled repos first in their existing order, declined ones grouped at the end.
  const ordered = [...entries.filter((e) => e.status === "enrolled"), ...entries.filter((e) => e.status !== "enrolled")];
  await writeFile(REPOS_JSON_PATH, formatRepos(ordered), "utf8");

  try {
    /** @type {{repo: string}[]} */
    const candidates = JSON.parse(await readFile(ENROLLMENT_PATH, "utf8"));
    const remaining = candidates.filter((c) => c.repo.toLowerCase() !== info.full_name.toLowerCase());
    if (remaining.length !== candidates.length) await writeFile(ENROLLMENT_PATH, `${JSON.stringify(remaining, null, 2)}\n`, "utf8");
  } catch {
    // No candidate file yet; nothing to drop.
  }

  console.log(`${info.full_name}: ${decision === "decline" ? "declined" : `enrolled as ${family}`}`);
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exitCode = 1;
});
