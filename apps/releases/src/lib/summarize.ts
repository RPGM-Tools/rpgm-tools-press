/**
 * Reduce a release body (raw markdown) down to a short one-line blurb for
 * list views: the first non-empty, non-heading line, stripped of the most
 * common inline markdown markers, capped to maxLength characters.
 */
export function summarize(body: string | undefined, maxLength = 150): string {
  if (!body) return "";

  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length > 0 &&
        !line.startsWith("#") &&
        !line.startsWith("|") &&
        !/^[-|: ]+$/.test(line),
    );

  const text = (firstLine ?? body.trim())
    .replace(/[*_`]/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1");

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}
