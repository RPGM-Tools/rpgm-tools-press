// @ts-check
/** Shared by the scripts that rewrite apps/releases/repos.json. */

/** Same layout as the hand-edited file: one entry per line. @param {object[]} entries */
export function formatRepos(entries) {
  const line = (/** @type {object} */ e) =>
    "  { " +
    Object.entries(e)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ") +
    " }";
  return `[\n${entries.map(line).join(",\n")}\n]\n`;
}
