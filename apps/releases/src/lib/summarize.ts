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

  /*
   * Prefer cutting at the end of a whole sentence over a blind character
   * count: an AI summary that ran to two sentences (written before the
   * prompt was tightened to ask for one) or an unusually long changelog
   * line read as broken mid-thought when hard-truncated with "..." - the
   * card looked cut off rather than just short. Keeping only the first
   * complete sentence instead reads as a normal, finished blurb. Only fall
   * back to an ellipsis when even that first sentence alone is still too
   * long to fit.
   */
  const sentenceMatch = text.match(/^.{1,}?[.!?](?=\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length <= maxLength) {
    return sentenceMatch[0];
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const wordBoundary = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${wordBoundary.trimEnd()}...`;
}
