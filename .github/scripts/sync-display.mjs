#!/usr/bin/env node
// @ts-check
/**
 * Copies each project's emoji and color from the Stuff registry into
 * apps/releases/repos.json, so the Ledger pages, the synced release entries and
 * the Discord announcements all show the values Stuff holds.
 *
 * Usage: node .github/scripts/sync-display.mjs
 * Env: STUFF_API_ACCESS_CLIENT_ID and STUFF_API_ACCESS_CLIENT_SECRET, a
 * Cloudflare Access service token for stuff.rpgm.tools. Without them the script
 * does nothing.
 *
 * GET https://stuff.rpgm.tools/api/display returns items shaped
 * {id, name, emoji, color, repos[]}. A repo is matched by its owner/name, and a
 * repo that no Stuff item lists keeps the values already in repos.json. The
 * values are written into repos.json instead of read at build time, so a Stuff
 * outage leaves the last known emoji and color in place.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatRepos } from "./lib/repos-file.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPOS_JSON_PATH = path.join(__dirname, "..", "..", "apps", "releases", "repos.json");
const DISPLAY_URL = "https://stuff.rpgm.tools/api/display";

/** @param {unknown} body @returns {{emoji?: string, color?: string, repos?: string[]}[]} */
function itemsOf(body) {
  const items = Array.isArray(body) ? body : /** @type {{items?: unknown}} */ (body)?.items;
  if (!Array.isArray(items)) throw new Error("the display response has no items list");
  return items;
}

async function main() {
  const clientId = process.env.STUFF_API_ACCESS_CLIENT_ID;
  const clientSecret = process.env.STUFF_API_ACCESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log("sync-display: no Stuff service token set, keeping the emoji and colors in repos.json");
    return;
  }

  const res = await fetch(DISPLAY_URL, {
    headers: { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Stuff returned ${res.status} ${res.statusText} for ${DISPLAY_URL}`);
  const items = itemsOf(await res.json());

  /** @type {Map<string, {emoji?: string, color?: string}>} */
  const byRepo = new Map();
  for (const item of items) {
    const emoji = typeof item.emoji === "string" && item.emoji.trim() ? item.emoji.trim() : undefined;
    const color = typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color.trim()) ? item.color.trim().toLowerCase() : undefined;
    for (const repo of item.repos ?? []) byRepo.set(String(repo).toLowerCase(), { emoji, color });
  }

  /** @type {Record<string, any>[]} */
  const entries = JSON.parse(await readFile(REPOS_JSON_PATH, "utf8"));
  const changed = [];
  for (const entry of entries) {
    if (entry.status !== "enrolled") continue;
    const display = byRepo.get(`${entry.owner}/${entry.repo}`.toLowerCase());
    if (!display) continue;
    if (display.emoji && entry.emoji !== display.emoji) {
      entry.emoji = display.emoji;
      changed.push(`${entry.owner}/${entry.repo} emoji`);
    }
    if (display.color && entry.color !== display.color) {
      entry.color = display.color;
      changed.push(`${entry.owner}/${entry.repo} color`);
    }
  }

  if (changed.length > 0) await writeFile(REPOS_JSON_PATH, formatRepos(entries), "utf8");
  console.log(`sync-display: ${changed.length > 0 ? `updated ${changed.join(", ")}` : "repos.json already matches Stuff"}`);
}

main().catch((err) => {
  console.error(`::warning::sync-display failed, keeping the emoji and colors in repos.json: ${err.message}`);
});
