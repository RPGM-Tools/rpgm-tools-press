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

### Fixed

- A release-listing card's width was set via a class passed into `EntryCard`
  from the parent page, but Astro's scoped-CSS attribute only matches
  elements written in the file that owns the `<style>` block - the rule
  never applied, so every card sat at its title's own content width instead
  of filling the row. Rule now uses `:global()`.
