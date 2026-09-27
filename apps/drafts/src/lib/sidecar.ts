import fs from "node:fs";
import path from "node:path";

export const DRAFTS_DIR = process.env.DRAFTS_DIR ?? "./.drafts";

export interface Claim {
  claim: string;
  evidence: string;
  source?: string;
}

export interface DraftState {
  /** waiting: ready for review. published, killed and parked drafts are left off the queue. */
  status: "waiting" | "published" | "killed" | "parked";
  revision: number;
  /** One line per note applied in the latest revision. */
  changes: string[];
  updated?: string;
}

function readJson<T>(slug: string, file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, slug, file), "utf-8")) as T;
  } catch {
    return undefined;
  }
}

export interface Share {
  platform: string;
  fit: number;
  blurb: string;
}

function coverFile(slug: string): string | undefined {
  try {
    return fs.readdirSync(path.join(DRAFTS_DIR, slug)).find((f) => /^cover\.(webp|png|jpe?g)$/.test(f));
  } catch {
    return undefined;
  }
}

function jsonl(file: string): Record<string, unknown>[] {
  try {
    return fs
      .readFileSync(path.join(DRAFTS_DIR, "..", file), "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}

/** How self-sufficient the drafter is getting, from the decision and note logs beside the drafts folder. */
export function stats() {
  const decisions = jsonl("taste/decisions.jsonl");
  const notes = jsonl("notes/notes.jsonl");
  const published = decisions.filter((d) => d.action === "approve");
  const noNotes = published.filter((d) => !notes.some((n) => n.draft === d.draft)).length;
  return {
    published: published.length,
    killed: decisions.filter((d) => d.action === "kill").length,
    notes: notes.length,
    notesPerPost: published.length ? notes.filter((n) => published.some((d) => d.draft === n.draft)).length / published.length : 0,
    noNotes,
  };
}

export function sidecar(slug: string) {
  return {
    cover: coverFile(slug),
    state: readJson<DraftState>(slug, "state.json") ?? { status: "waiting", revision: 1, changes: [] },
    meta: readJson<Record<string, unknown>>(slug, "meta.json") ?? {},
    claims: readJson<Claim[]>(slug, "claims.json") ?? [],
  };
}
