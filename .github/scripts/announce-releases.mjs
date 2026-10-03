#!/usr/bin/env node
// @ts-check
/**
 * Posts each new release on the Ledger to its family's Discord announcements
 * forum. Runs in deploy-releases.yml after the site deploys, so the Ledger link
 * in the post already works.
 *
 * Usage: node .github/scripts/announce-releases.mjs
 *
 * Env, per family (NEO_ANGBAND, RPGM_TOOLS, OTHER_PROJECTS):
 *   DISCORD_WEBHOOK_<F>          the forum's webhook URL (secret)
 *   DISCORD_<F>_RELEASE_TAG_ID   forum tag applied to the new thread
 *   DISCORD_<F>_ROLE_ID          opt-in News role, mentioned in a reply after the
 *                                silent first post so only its members are notified
 *   DISCORD_<F>_MODE             "live" or "dry-run"; neo-angband defaults to
 *                                dry-run while the per-repo announcers still
 *                                post, the other families default to live
 *
 * Webhook name, avatar and footer per family live in
 * apps/releases/discord-families.json.
 *
 * apps/releases/announced.json lists every release id already handled. A
 * release is posted once, and only if it was published after its repo's
 * `enrolledAt` and within the last MAX_AGE_DAYS, so enrolling a repo with a
 * long history never floods the channel. Releases too old to post are recorded
 * as handled without posting. A family with no webhook is skipped and its
 * releases stay unrecorded, so they post once the webhook exists (still subject
 * to the age limit). If announced.json is missing, every current release is
 * recorded and nothing is posted.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const APP_ROOT = path.join(REPO_ROOT, "apps", "releases");
const CONTENT_ROOT = path.join(APP_ROOT, "src", "content", "releases");
const ANNOUNCED_PATH = path.join(APP_ROOT, "announced.json");
// Discord message flag 1 << 12: no push or desktop notification for anyone.
const SUPPRESS_NOTIFICATIONS = 1 << 12;
const SITE = "https://releases.rpgm.tools";
const MAX_AGE_DAYS = 7;
const EMBED_DESCRIPTION_LIMIT = 4096;

/** @param {string} family */
function envKey(family) {
  return family.toUpperCase().replace(/-/g, "_");
}

/** @param {string} text */
function parseEntry(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  /** @type {Record<string, string>} */
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(".*")\s*$/);
    if (kv) data[kv[1]] = JSON.parse(kv[2]);
  }
  return { data, body: match[2].trim() };
}

/**
 * Discord renders a literal newline as a hard line break, so a hand-wrapped
 * CHANGELOG paragraph shows as a ragged column. Rejoins each paragraph or list
 * item onto one line; blank lines, headings, list boundaries and fenced code
 * are left alone. Ported from the per-repo discord-announce.mjs.
 */
function joinWrapped(text, next) {
  return text.endsWith("/") ? text + next : `${text} ${next}`;
}

/** @param {string} markdown */
export function reflow(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const out = [];
  let inFence = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/u.test(line)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }
    if (inFence || line.trim() === "" || /^#{1,6}\s/u.test(line)) {
      out.push(line);
      i++;
      continue;
    }
    const bulletMatch = line.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/u);
    if (bulletMatch) {
      const [, marker, firstText] = bulletMatch;
      const indent = " ".repeat(marker.length);
      let text = firstText;
      i++;
      while (i < lines.length && lines[i].trim() !== "" && lines[i].startsWith(indent) && !/^\s*(?:[-*]|\d+[.)])\s+/u.test(lines[i])) {
        text = joinWrapped(text, lines[i].trim());
        i++;
      }
      out.push(marker + text);
      continue;
    }
    let text = line.trim();
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/u.test(lines[i]) &&
      !/^\s*(?:[-*]|\d+[.)])\s+/u.test(lines[i]) &&
      !/^\s*```/u.test(lines[i])
    ) {
      text = joinWrapped(text, lines[i].trim());
      i++;
    }
    out.push(text);
  }
  return out.join("\n");
}

/**
 * Cuts on blank-line blocks so a paragraph fits whole or not at all; a single
 * block that overflows (a long list) is cut line by line. Ported from the
 * per-repo discord-announce.mjs.
 * @param {string} body @param {number} maxChars @param {string} fullUrl
 */
export function fitToLimit(body, maxChars, fullUrl) {
  if (body.length <= maxChars) return body;
  const notice = `\n\n*(cut short - [full notes](${fullUrl}))*`;
  const budget = maxChars - notice.length;
  let out = "";
  for (const block of body.split(/\n\n/u)) {
    const next = out ? `${out}\n\n${block}` : block;
    if (next.length <= budget) {
      out = next;
      continue;
    }
    const prefix = out ? `${out}\n\n` : "";
    const remaining = budget - prefix.length;
    if (remaining > 0) {
      let partial = "";
      for (const line of block.split("\n")) {
        const nextPartial = partial ? `${partial}\n${line}` : line;
        if (nextPartial.length > remaining) break;
        partial = nextPartial;
      }
      if (partial) out = prefix + partial;
    }
    break;
  }
  if (!out) out = body.slice(0, Math.max(0, budget));
  return out + notice;
}

/**
 * The opt-in News role gets its own reply in the new thread. The thread's first message is sent silent, which blocks every push and desktop notification including role pings, so only members holding the role (or following the thread) are notified by this reply.
 * @param {string} roleId
 * @param {{thread_name: string}} payload
 */
export function buildRolePing(roleId, payload) {
  return {
    content: `<@&${roleId}> ${payload.thread_name} has shipped!`,
    allowed_mentions: { roles: [roleId] },
  };
}

/**
 * @param {{displayName: string, kind?: string, emoji?: string, color?: string}} tracked
 * @param {{username: string, avatarUrl: string, namePrefix: string, footer: Record<string, string>}} look
 * @param {{version: string, url: string}} data
 * @param {string} body
 * @param {string} ledgerUrl
 * @param {{tagId?: string, roleId?: string}} ids
 */
export function buildPayload(tracked, look, data, body, ledgerUrl, ids) {
  const title = look.namePrefix && tracked.displayName.startsWith(look.namePrefix) ? tracked.displayName.slice(look.namePrefix.length) : tracked.displayName;
  const emoji = tracked.emoji ? `${tracked.emoji} ` : "";
  const version = data.version.replace(/^.*?v(?=\d)/, "");
  const footer = (look.footer[tracked.kind ?? ""] ?? look.footer.default).replace("{title}", title);
  const ledgerLine = `\n\n[Release notes on The Ledger](${ledgerUrl})`;
  const description = fitToLimit(reflow(body), EMBED_DESCRIPTION_LIMIT - ledgerLine.length, ledgerUrl) + ledgerLine;
  const headline = `${emoji}**${title} v${version}** has shipped!`;
  return {
    username: look.username,
    avatar_url: look.avatarUrl,
    thread_name: `${emoji}${title} v${version}`,
    ...(ids.tagId ? { applied_tags: [ids.tagId] } : {}),
    content: headline,
    flags: SUPPRESS_NOTIFICATIONS,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `v${version}`,
        url: data.url,
        description,
        color: tracked.color ? Number.parseInt(tracked.color.replace("#", ""), 16) : undefined,
        footer: { text: footer },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function listEntries() {
  const entries = [];
  for (const folder of await readdir(CONTENT_ROOT)) {
    let files;
    try {
      files = await readdir(path.join(CONTENT_ROOT, folder));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const parsed = parseEntry(await readFile(path.join(CONTENT_ROOT, folder, file), "utf8"));
      if (parsed) entries.push({ id: `${folder}/${file.replace(/\.md$/, "")}`, ...parsed });
    }
  }
  return entries.sort((a, b) => (a.data.publishedAt ?? "").localeCompare(b.data.publishedAt ?? ""));
}

async function main() {
  /** @type {Record<string, any>[]} */
  const repos = JSON.parse(await readFile(path.join(APP_ROOT, "repos.json"), "utf8"));
  const enrolled = new Map(repos.filter((r) => r.status === "enrolled").map((r) => [`${r.owner}/${r.repo}`.toLowerCase(), r]));
  const looks = JSON.parse(await readFile(path.join(APP_ROOT, "discord-families.json"), "utf8"));
  const entries = await listEntries();

  /** @type {Set<string> | null} */
  let announced = null;
  try {
    announced = new Set(JSON.parse(await readFile(ANNOUNCED_PATH, "utf8")));
  } catch {
    // Missing file: record everything, post nothing.
  }

  const seeding = announced === null;
  const handled = announced ?? new Set();
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const counts = { posted: 0, dryRun: 0, tooOld: 0, noWebhook: 0, failed: 0 };

  for (const entry of entries) {
    if (handled.has(entry.id)) continue;
    const tracked = enrolled.get((entry.data.repo ?? "").toLowerCase());
    if (!tracked) continue;
    if (seeding) {
      handled.add(entry.id);
      continue;
    }

    const published = Date.parse(entry.data.publishedAt);
    if (!(published >= Date.parse(tracked.enrolledAt)) || published < cutoff) {
      handled.add(entry.id);
      counts.tooOld += 1;
      continue;
    }

    const key = envKey(tracked.family);
    const webhook = process.env[`DISCORD_WEBHOOK_${key}`];
    const mode = process.env[`DISCORD_${key}_MODE`] || (tracked.family === "neo-angband" ? "dry-run" : "live");
    const look = looks[tracked.family];
    const payload = buildPayload(tracked, look, entry.data, entry.body, `${SITE}/releases/${entry.id}/`, {
      tagId: process.env[`DISCORD_${key}_RELEASE_TAG_ID`] || undefined,
      roleId: process.env[`DISCORD_${key}_ROLE_ID`] || undefined,
    });

    if (mode !== "live") {
      console.log(`[dry-run] ${tracked.family}: ${payload.thread_name}`);
      handled.add(entry.id);
      counts.dryRun += 1;
      continue;
    }
    if (!webhook) {
      console.log(`[skipped] ${tracked.family} has no webhook yet: ${payload.thread_name}`);
      counts.noWebhook += 1;
      continue;
    }

    const res = await fetch(`${webhook}?wait=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log(`[posted] ${tracked.family}: ${payload.thread_name}`);
      handled.add(entry.id);
      counts.posted += 1;
      const roleId = process.env[`DISCORD_${key}_ROLE_ID`];
      if (roleId) {
        const posted = await res.json().catch(() => null);
        const threadId = posted?.channel_id ?? posted?.id;
        const ping = threadId
          ? await fetch(`${webhook}?thread_id=${threadId}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(buildRolePing(roleId, payload)),
            })
          : null;
        if (!ping?.ok) console.log(`::warning::News role ping failed for ${payload.thread_name}: ${ping ? ping.status : "no thread id"}`);
      }
    } else {
      console.log(`::warning::Discord returned ${res.status} for ${payload.thread_name}: ${(await res.text()).slice(0, 200)}`);
      counts.failed += 1;
    }
  }

  await writeFile(ANNOUNCED_PATH, `${JSON.stringify([...handled].sort(), null, 2)}\n`, "utf8");
  console.log(
    seeding
      ? `=== announce-releases: seeded ${handled.size} existing release(s), nothing posted ===`
      : `=== announce-releases: posted ${counts.posted}, dry-run ${counts.dryRun}, too old ${counts.tooOld}, waiting on a webhook ${counts.noWebhook}, failed ${counts.failed} ===`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`::error::${err.stack || err}`);
    process.exitCode = 1;
  });
}
