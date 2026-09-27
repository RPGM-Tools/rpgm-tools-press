import repos from "../../repos.json";

export const FAMILIES = [
  { id: "neo-angband", label: "Neo Angband" },
  { id: "rpgm-tools", label: "RPGM Tools" },
  { id: "other-projects", label: "Other Projects" },
] as const;

export type FamilyId = (typeof FAMILIES)[number]["id"];

export interface TrackedRepo {
  owner: string;
  repo: string;
  displayName: string;
  family: FamilyId;
  status: "enrolled";
  enrolledAt: string;
  kind?: "core" | "mod" | "tool";
  releaseSource?: "releases" | "tags";
  tagPrefix?: string;
  emoji?: string;
  color?: string;
}

/** repos.json also records declined repos so discovery never offers them again; only enrolled ones appear on the site. */
export const enrolledRepos = (repos as { status: string }[]).filter((r) => r.status === "enrolled") as TrackedRepo[];

const familyByRepo = new Map(enrolledRepos.map((r) => [`${r.owner}/${r.repo}`.toLowerCase(), r.family]));

export function familyOf(fullName: string): FamilyId | undefined {
  return familyByRepo.get(fullName.toLowerCase());
}

/** Families that have at least one enrolled repo, in display order. */
export const activeFamilies = FAMILIES.filter((f) => enrolledRepos.some((r) => r.family === f.id));
