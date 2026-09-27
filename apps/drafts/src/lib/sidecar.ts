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

export function sidecar(slug: string) {
  return {
    state: readJson<DraftState>(slug, "state.json") ?? { status: "waiting", revision: 1, changes: [] },
    meta: readJson<Record<string, unknown>>(slug, "meta.json") ?? {},
    claims: readJson<Claim[]>(slug, "claims.json") ?? [],
  };
}
