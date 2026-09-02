import { visit } from "unist-util-visit";
import type { Root, ListItem, Paragraph, Text, Parent } from "mdast";

/**
 * Renders the changelog chip-tag convention (see the `changelog-convention`
 * skill / CLAUDE.md): a raw markdown list item written as
 * `- [Visible] [Search] Lead sentence...` would otherwise render as literal
 * bracket text - Astro's default markdown pipeline has no idea these are a
 * convention, not just punctuation. This walks every list item, and where
 * one starts with one or more `[Word]` groups, replaces them with styled
 * inline chips and leaves the rest of the sentence as normal text.
 *
 * Only ever touches a list item's own first paragraph/first text node, so
 * it can't misfire on a `[link](url)`-style markdown construct elsewhere
 * in a bullet - those parse as `link` nodes, not literal bracket text, by
 * the time this plugin sees the tree.
 */
const VISIBILITY_TAGS = new Set(["Visible", "Internal"]);
const LEADING_TAG_PATTERN = /^\[([A-Za-z][\w-]*)\]\s*/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export default function remarkChangelogChips() {
  return (tree: Root) => {
    visit(tree, "listItem", (listItem: ListItem) => {
      const firstChild = listItem.children[0] as Paragraph | undefined;
      if (!firstChild || firstChild.type !== "paragraph") return;

      const firstText = firstChild.children[0] as Text | undefined;
      if (!firstText || firstText.type !== "text") return;

      const tags: string[] = [];
      let remaining = firstText.value;
      let match: RegExpExecArray | null;
      while ((match = LEADING_TAG_PATTERN.exec(remaining))) {
        tags.push(match[1] ?? "");
        remaining = remaining.slice(match[0].length);
      }
      if (tags.length === 0) return;

      const chipsHtml = tags
        .map((tag) => {
          const kind = VISIBILITY_TAGS.has(tag) ? tag.toLowerCase() : "category";
          return `<span class="rpgm-changelog-chip rpgm-changelog-chip--${kind}">${escapeHtml(tag)}</span>`;
        })
        .join("");

      firstText.value = remaining.replace(/^\s+/, "");
      (firstChild.children as Parent["children"]).splice(0, 0, {
        type: "html",
        value: `<span class="rpgm-changelog-chips">${chipsHtml}</span> `,
      } as never);
    });
  };
}
