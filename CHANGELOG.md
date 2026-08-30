# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Full-text search on both sites via Pagefind, indexed as a postbuild step
  and mounted lazily from the header's search trigger.
- GitHub Discussions-backed comments via giscus on blog posts and release
  pages, gated behind a real Discussion category ID per app.
- Cloudflare Web Analytics wiring in the shared Layout, enabled per app via
  a `PUBLIC_CF_BEACON_TOKEN` build-time env var.
- Release notes for mod repos, previously never synced since mods have no
  formal GitHub Releases - a repo's tags are now read directly when it has
  no Release objects at all.
- Real download links (with file size) on release pages with binary assets,
  and a per-product emoji seal on every release entry.
- A release-listing card's blurb is now an AI-synthesized 1-2 sentence
  summary (via MiniMax-M3) of that version's changelog section, generated
  once at sync time and cached in frontmatter - not re-requested on later
  syncs, and not requested at all for a tag that already has one, since a
  git tag's content never changes. Falls back to the previous first-line
  truncation when no key is configured or a call fails.
- Each release card now carries a thin left-edge accent stripe in that
  repo's own color, mirrored from the same repo's `discord-announce.mjs`
  color so one identity carries across Discord and the site. The hover
  glow stays the site's single consistent gold, not recolored per repo.
- Both sites now show their own logo in the header and as a favicon (The
  Ledger, Relics & Reckonings), and a larger RPGM Tools emblem plus a
  "Copyright RPGM Tools, LLC" line in the shared footer, linking to
  rpgm.tools.
- Blog posts now carry a byline (avatar and name) under the title.
- Blog post cards (and the post page itself) now carry a solid-tinted
  category chip ahead of their plain tag chips, colored per category -
  neo-angband reuses that repo's own accent so the category carries the
  same identity everywhere else it appears.
- A light/dark/system theme toggle in the header. Defaults to system (no
  stored choice at all): an unvisited reader's OS preference decides,
  and clicking the toggle stores an explicit override that wins from then
  on. The Ledger carries its own cool graphite-toned light palette rather
  than falling back to the base theme's warm parchment look.
- Pressing "/" anywhere (outside a text field) opens search, same as
  clicking the search button; the search panel is now themed to match
  each site instead of showing Pagefind's generic light-mode default, and
  blog posts are filterable by tag and category from within it.
- Footer now also links to the site's RSS feed and its own source repo.

### Changed

- Release notes now come from that version's own section of `CHANGELOG.md`
  at its tag, not a GitHub Release's `body` - drops the download-instructions
  preamble and boilerplate footer that body carried, keeping only the actual
  changelog.
- A release page no longer repeats its title in the body, and its links are
  reordered: notes, downloads, a link to play the game, the release/tag link,
  the repo link, and (for a mod) a link to the main game repo.
- A strict `vX.Y.Z` tag, not GitHub's own `prerelease` flag, decides what
  syncs - excludes rolling "edge" builds while including the full pre-1.0
  alpha history, which GitHub's flag had also marked prerelease.
- Release page URLs now keep a version's dots (`v1.3.0`, not `v130`) -
  the previous default id generation stripped them, which could collide
  across distinct versions.
- A synced entry's `publishedAt` now prefers the real release/commit
  timestamp over the changelog heading's day-only date, so two releases on
  the same calendar day sort correctly instead of tying and falling back to
  the content loader's own (not guaranteed stable) file read order.
- Emoji seals are larger on the release listing than on a release's own
  page, to read better as a scannable list mark without overpowering the
  page title.
- The footer's top row no longer states a nonsensical "(c) Year <site
  nickname>" - a site's own display name was never the copyright holder.
  It now shows the site name plus RSS/Source links, with the real
  copyright (RPGM Tools, LLC) as its own centered block below: emblem,
  then the copyright line, stacked.
- The seed blog posts' body copy is now genuine Lorem Ipsum placeholder
  text rather than fabricated first-person narrative - the earlier prose
  read as real personal essays despite never having been written by
  anyone. Frontmatter (title, tags, category, dates) is unchanged.

### Fixed

- A global typography rule meant only for rendered post/changelog bodies
  (`li + li { margin-top }`, plus the rest of `tokens/typography.css`'s
  list/table/blockquote/code rules) was never scoped to `.rpgm-prose` and
  bled into every other `<ul>` on a page - it gave the second-and-later
  chip in a card's tag list, the second nav link, and the second footer
  link a phantom top margin, throwing off their flex-line stretch height
  and reading as misaligned/inconsistent-height pills. Now scoped to
  `.rpgm-prose` only.
- A card's accent stripe (`EntryCard`) and its hover-glow ring were each
  independently rounded, a border-width apart, and never quite lined up -
  visible as a seam right at the corner on hover. The card now clips the
  stripe to its own border-radius via `overflow: hidden` instead of
  hand-matching a second radius.
- An app's `skin.css` set `--rpgm-bg`/`--rpgm-surface`/etc. at a bare
  `:root`, which (CSS layers ignore selector specificity) always beat
  base.css's own light-mode values regardless of theme - a light-mode
  reader saw white cards on an unchanged dark page background. Each
  skin's overrides are now gated to the same "is this theme actually
  active" conditions base.css itself uses.
- A release-listing card's width was set via a class passed into `EntryCard`
  from the parent page, but Astro's scoped-CSS attribute only matches
  elements written in the file that owns the `<style>` block - the rule
  never applied, so every card sat at its title's own content width instead
  of filling the row. Rule now uses `:global()`.
