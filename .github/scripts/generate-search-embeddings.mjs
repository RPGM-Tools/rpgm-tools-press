#!/usr/bin/env node
// @ts-check
/**
 * Generates the static semantic-search document vectors consumed by
 * ListFilter.astro. Vectors are cached by a hash of the source text, so a
 * normal content sync only calls Workers AI for new or changed entries.
 *
 * Usage:
 *   node .github/scripts/generate-search-embeddings.mjs [all|blog|releases]
 *   node .github/scripts/generate-search-embeddings.mjs [all|blog|releases] --check
 *
 * Auth: CLOUDFLARE_API_TOKEN, with `wrangler auth token` as a local fallback.
 * CLOUDFLARE_ACCOUNT_ID is required. `--check` is offline and only verifies
 * that the committed artifacts still correspond to their content sources.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const DIMENSIONS = 1024;
// Qwen3 supports 8,192 input tokens. A conservative character cap keeps each
// chunk within that window without adding a tokenizer dependency. Long
// entries use every chunk, averaged back into the required one vector.
const MAX_INPUT_CHARACTERS = 24_000;
const BATCH_SIZE = 16;

const APP_CONFIG = {
  blog: {
    sourceRoot: path.join(REPO_ROOT, "apps", "blog", "src", "content", "posts"),
    outputPath: path.join(REPO_ROOT, "apps", "blog", "public", "search-embeddings.json"),
    recursive: false,
    urlFor(relativePath) {
      return `/posts/${withoutExtension(relativePath)}/`;
    },
    metadataKeys: ["title", "description", "category", "tags"],
    include(frontmatter) {
      return frontmatter.draft !== true;
    },
  },
  releases: {
    sourceRoot: path.join(REPO_ROOT, "apps", "releases", "src", "content", "releases"),
    outputPath: path.join(REPO_ROOT, "apps", "releases", "public", "search-embeddings.json"),
    recursive: true,
    urlFor(relativePath) {
      return `/releases/${withoutExtension(relativePath)}/`;
    },
    metadataKeys: ["repoDisplayName", "version", "kind", "summary"],
    include() {
      return true;
    },
  },
};

function withoutExtension(relativePath) {
  return relativePath.replace(/\.md$/i, "").split(path.sep).join("/");
}

async function markdownFiles(root, recursive) {
  const files = [];

  async function visit(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory() && recursive) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function parseFrontmatterValue(rawValue) {
  const value = rawValue.trim();
  try {
    return JSON.parse(value);
  } catch {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }
}

function splitMarkdown(source) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: normalized };

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (field) frontmatter[field[1]] = parseFrontmatterValue(field[2]);
  }

  return { frontmatter, body: match[2] };
}

function textForEmbedding(frontmatter, body, metadataKeys) {
  const metadata = metadataKeys.flatMap((key) => {
    const value = frontmatter[key];
    if (value === undefined || value === null || value === "") return [];
    return [Array.isArray(value) ? value.join(", ") : String(value)];
  });

  return [...metadata, body]
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function chunksForModelContext(text) {
  if (text.length <= MAX_INPUT_CHARACTERS) return [text];

  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + MAX_INPUT_CHARACTERS, text.length);
    if (end < text.length) {
      const paragraphBoundary = text.lastIndexOf("\n\n", end);
      const wordBoundary = text.lastIndexOf(" ", end);
      const boundary = paragraphBoundary > offset + MAX_INPUT_CHARACTERS / 2
        ? paragraphBoundary
        : wordBoundary;
      if (boundary > offset) end = boundary;
    }
    chunks.push(text.slice(offset, end).trim());
    offset = end;
    while (/\s/.test(text[offset] ?? "")) offset += 1;
  }
  return chunks;
}

function contentHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function unitVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Workers AI returned a zero or invalid embedding vector");
  }
  return vector.map((value) => Math.round((value / magnitude) * 1_000_000) / 1_000_000);
}

function validVector(vector) {
  return Array.isArray(vector) && vector.length === DIMENSIONS && vector.every(Number.isFinite);
}

async function readExisting(outputPath) {
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    if (parsed?.model !== MODEL || parsed?.dimensions !== DIMENSIONS || !Array.isArray(parsed?.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function resolveToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;

  try {
    const command = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
    const { stdout } = await execFileAsync(command, ["auth", "token"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const token = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .findLast((line) => /^[A-Za-z0-9._~-]{40,}$/.test(line));
    if (token) return token;
  } catch {
    // The actionable message below covers both a missing CLI and stale login.
  }

  throw new Error(
    "No Cloudflare token available. Set CLOUDFLARE_API_TOKEN or log in with a Wrangler version that supports `wrangler auth token`.",
  );
}

async function embedDocuments(documents) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required to generate embeddings");
  const token = await resolveToken();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;
  async function embedBatch(batch) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documents: batch }),
    });
    const payload = await response.json();
    const data = payload?.result?.data ?? payload?.data;
    if (!response.ok || !Array.isArray(data) || data.length !== batch.length) {
      const message = payload?.errors?.[0]?.message ?? `${response.status} ${response.statusText}`;
      if (batch.length > 1 && /input too big/i.test(message)) {
        const middle = Math.ceil(batch.length / 2);
        const [left, right] = await Promise.all([
          embedBatch(batch.slice(0, middle)),
          embedBatch(batch.slice(middle)),
        ]);
        return [...left, ...right];
      }
      throw new Error(`Workers AI embedding request failed: ${message}`);
    }
    return data.map((vector) => {
      if (!validVector(vector)) throw new Error(`Workers AI returned an unexpected embedding shape (wanted ${DIMENSIONS})`);
      return unitVector(vector);
    });
  }

  const vectors = [];
  for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
    const batch = documents.slice(offset, offset + BATCH_SIZE);
    vectors.push(...await embedBatch(batch));
  }

  return vectors;
}

async function sourceEntries(appName) {
  const config = APP_CONFIG[appName];
  const files = await markdownFiles(config.sourceRoot, config.recursive);
  const entries = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const { frontmatter, body } = splitMarkdown(source);
    if (!config.include(frontmatter)) continue;
    const fullText = textForEmbedding(frontmatter, body, config.metadataKeys);
    const relativePath = path.relative(config.sourceRoot, filePath);
    entries.push({
      url: config.urlFor(relativePath),
      contentHash: contentHash(fullText),
      inputs: chunksForModelContext(fullText),
    });
  }

  return entries;
}

async function checkApp(appName) {
  const config = APP_CONFIG[appName];
  const sources = await sourceEntries(appName);
  const existing = await readExisting(config.outputPath);
  if (!existing) throw new Error(`${appName}: missing or incompatible ${path.relative(REPO_ROOT, config.outputPath)}`);

  const existingByUrl = new Map(existing.entries.map((entry) => [entry.url, entry]));
  const problems = [];
  for (const source of sources) {
    const entry = existingByUrl.get(source.url);
    if (!entry) problems.push(`missing ${source.url}`);
    else if (entry.contentHash !== source.contentHash) problems.push(`stale ${source.url}`);
    else if (!validVector(entry.vector)) problems.push(`invalid vector ${source.url}`);
  }
  const sourceUrls = new Set(sources.map((entry) => entry.url));
  for (const entry of existing.entries) {
    if (!sourceUrls.has(entry.url)) problems.push(`orphaned ${entry.url}`);
  }
  if (problems.length > 0) throw new Error(`${appName}: ${problems.join(", ")}`);
  console.log(`${appName}: ${sources.length} semantic-search embeddings are current`);
}

async function generateApp(appName) {
  const config = APP_CONFIG[appName];
  const sources = await sourceEntries(appName);
  const existing = await readExisting(config.outputPath);
  const existingByUrl = new Map((existing?.entries ?? []).map((entry) => [entry.url, entry]));

  const fresh = new Map();
  const stale = [];
  for (const source of sources) {
    const cached = existingByUrl.get(source.url);
    if (cached?.contentHash === source.contentHash && validVector(cached.vector)) {
      fresh.set(source.url, cached.vector);
    } else {
      stale.push(source);
    }
  }

  if (stale.length > 0) {
    console.log(`${appName}: generating ${stale.length} new or changed embedding${stale.length === 1 ? "" : "s"}`);
    const vectors = await embedDocuments(stale.flatMap((entry) => entry.inputs));
    let vectorOffset = 0;
    for (const entry of stale) {
      const chunkVectors = vectors.slice(vectorOffset, vectorOffset + entry.inputs.length);
      vectorOffset += entry.inputs.length;
      if (chunkVectors.length === 1) {
        fresh.set(entry.url, chunkVectors[0]);
        continue;
      }
      const averaged = Array.from({ length: DIMENSIONS }, (_, dimension) =>
        chunkVectors.reduce((sum, vector) => sum + vector[dimension], 0) / chunkVectors.length,
      );
      fresh.set(entry.url, unitVector(averaged));
    }
  }

  const entries = sources.map(({ url, contentHash: hash }) => ({
    url,
    contentHash: hash,
    vector: fresh.get(url),
  }));
  const changed =
    stale.length > 0 ||
    !existing ||
    existing.entries.length !== entries.length ||
    entries.some((entry, index) => existing.entries[index]?.url !== entry.url);

  if (!changed) {
    console.log(`${appName}: ${entries.length} embeddings unchanged`);
    return;
  }

  const artifact = {
    version: 1,
    model: MODEL,
    dimensions: DIMENSIONS,
    normalized: true,
    maxInputCharacters: MAX_INPUT_CHARACTERS,
    generatedAt: new Date().toISOString(),
    entries,
  };
  await mkdir(path.dirname(config.outputPath), { recursive: true });
  await writeFile(config.outputPath, `${JSON.stringify(artifact)}\n`, "utf8");
  console.log(`${appName}: wrote ${entries.length} embeddings to ${path.relative(REPO_ROOT, config.outputPath)}`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const target = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "all";
  const apps = target === "all" ? Object.keys(APP_CONFIG) : [target];
  if (apps.some((app) => !Object.hasOwn(APP_CONFIG, app))) {
    throw new Error(`Unknown target "${target}"; expected all, blog, or releases`);
  }

  for (const app of apps) {
    if (checkOnly) await checkApp(app);
    else await generateApp(app);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
