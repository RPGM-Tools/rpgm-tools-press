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
    // A raw changelog line still carries its own "- " bullet marker, and
    // (per the chip-tag convention - see remark-changelog-chips.ts, which
    // handles this for the full release body) may open with one or more
    // `[Visible]`/`[Category]` tags meant to render as chips, not literal
    // brackets. This blurb is plain text, not markdown, so there's nothing
    // to render them as here - just drop them, the same way the detail
    // page turns them into chips instead of showing them as text.
    .replace(/^-\s+/, "")
    .replace(/^(?:\[[A-Za-z][\w-]*\]\s*)+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1");

  /*
   * A whole sentence, however long, reads as finished; a maxLength-based
   * slice reads as cut off - that's true regardless of how much longer
   * than maxLength the sentence runs, so there's no length gate here on
   * purpose. This is what actually fixes cards that looked truncated: an
   * AI summary written before the prompt was tightened to one sentence
   * often has a first sentence well past 130 characters on its own, and a
   * gate here would still fall through to the ugly ellipsis path for
   * every one of those - the exact case that needed fixing. Ellipsis
   * truncation is the last resort, only for text with no sentence-ending
   * punctuation anywhere (a bare fragment, or markdown with none).
   */
  const sentenceMatch = text.match(/^.{1,}?[.!?](?=\s|$)/);
  if (sentenceMatch) return sentenceMatch[0];

  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const wordBoundary = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${wordBoundary.trimEnd()}...`;
}
