# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A live text filter above every blog listing page (home, archive, tag pages):
  typing narrows the visible entries in place, in real time, by title/tag/
  category - distinct from the header's Pagefind search, which indexes the
  whole built site and opens its own results panel. The two cover different
  jobs: "search everything ever published" versus "narrow what's already on
  this page."
- A subtle paper-grain texture (inline SVG noise, no network request) behind
  every page, on top of the flat background color.
- `Flourish` now draws itself in - a pen-stroke reveal on the blog, a
  wax-seal-style stamp on The Ledger - the first time it scrolls into view,
  instead of sitting fully rendered from first paint. Falls back to a plain,
  fully-drawn static rendering with no JS dependency.
- A "RPGM Tools, LLC" section on the About page, with the company's own
  logo next to the heading - drafted as a first pass on the company itself
  (not the tool suite), to be refined further.
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
- An About page on the blog, linked from the nav, with a real author bio.
- The search field itself, not just the results, is themed: clicking the
  search trigger (or pressing "/") turns it into the actual input in
  place, instead of leaving an unchanged button next to a second field
  that appears somewhere else.
- The Ledger's release list is now a ruled register (date gutter, a thin
  per-repo accent tick, monospace dates) instead of a stack of full-width
  cards, with an entry/repo-count "last synchronized" line at the top -
  it reads as a scannable log rather than the blog's own card list
  wearing a different color. A new Repositories page (linked from the
  nav) lists every tracked repo; its own per-repo pages were previously
  unreachable from anywhere in the site.
- Prose headings (h2/h3) inside a post or changelog body get a gold rule,
  small-caps, and real top margin, and a post's opening paragraph gets a
  manuscript-style drop cap - a section break used to read as barely more
  than a line-height gap.

### Changed

- The base body text size is bigger (1.0625rem to 1.25rem) and the page
  shell narrower (76rem to 64rem): EB Garamond's narrow, small-x-height
  letterforms meant the 42rem reading column was already landing around
  85-95 characters per line at the old size - wide for its measure, not
  narrow - and read as optically small rather than actually too narrow.
  Raising the base size tightens that measure into the middle of a
  comfortable range; narrowing the shell lets the header/footer chrome
  actually bracket the text column instead of framing ~270px of bare
  margin on each side that nothing (there's no advertising or sidebar
  content) was ever going to fill.
- A release-listing card's AI-synthesized summary is now capped to a fixed
  length at render time (regardless of what the model actually returned),
  and the prompt itself now asks for one short sentence instead of "at most
  two" - the model's output was often long enough to read as a recap rather
  than a scannable one-line blurb.
- The About page bio is now three short paragraphs (what I do for work,
  what I studied, what I build in my free time) instead of a longer
  credentials-focused essay - the free-time paragraph deliberately doesn't
  call RPGM Tools/Neo Angband "for fun," since the goal is a real business,
  not a hobby.
- A post/release page's title, byline, tags, and body are now all
  constrained to the same centered 42rem column the page's own decorative
  divider already used - previously only the divider was centered while the
  words around it spanned the full page width.
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

- Opening the search field could push the theme toggle onto its own line
  below it, since the header's nav links, the growing search field, and the
  toggle all shared one wrapping row and ran out of width together. Nav
  links now hide themselves while search is open (they're not needed mid-
  search anyway), freeing enough room for the field and the toggle to stay
  on the same row. Hit the same cross-component Astro scoped-CSS gap this
  project has hit before (`EntryCard`, `Flourish`): a parent component's
  selector targeting a class a CHILD component renders never matches,
  because the child's elements carry the child's own scope attribute, not
  the parent's - needed `:global()` again.
- An AI-synthesized release summary that ran long (or a changelog line with
  no natural short form) was hard-truncated at a fixed character count with
  an ellipsis, which could cut off mid-sentence and read as broken rather
  than short. It now prefers cutting at the end of a whole sentence, only
  falling back to a word-boundary ellipsis when even one full sentence is
  still too long to fit.
- The search trigger's own button was never actually hidden once its panel
  opened: `button.hidden = true` had no visual effect, since the button's own
  `display: inline-flex` rule (an author stylesheet rule) always beat the
  browser's built-in `[hidden] { display: none }` (author rules win over the
  user-agent stylesheet regardless of selector specificity). This went
  unnoticed while the open panel was absolutely positioned on top of the
  header, covering the still-visible button; it became visible the moment
  the panel below stopped being absolutely positioned.
- The open search panel was absolutely positioned over the header instead of
  claiming real layout space, so on any header too narrow to spare 20+rem
  next to it, it drew on top of the nav links and logo to its left rather
  than pushing them aside. It's now a normal in-flow flex item that grows,
  letting the header's own row wrap around it.
- The smallest text sizes in the scale (chip labels, dates, the eyebrow
  label) were tuned for a desktop reading distance and read as genuinely
  tiny on a phone; bumped at narrow viewports only.
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
- The dark-mode gold accent (used directly as text color for links, the
  eyebrow label, and card dates) measured ~1.9:1 against light-mode
  parchment and ~2.4:1 against white - both well under WCAG AA's 4.5:1.
  Light mode now uses a deeper antique-gold that clears 4.5:1 against
  both. The focus ring was also hardcoded to the raw gold anchor color
  regardless of site or theme, which put a warm ring (failing contrast in
  light mode) on The Ledger's cool palette too; it now follows the active
  accent token.
- A category chip's text used the category's own raw color, several of
  which (graphite, dark red) are themselves dark - as text on a dark card
  with only a faint tint behind it, that measured as low as ~1.15:1. Chip
  text is now always the theme's own high-contrast foreground color; the
  category color still carries the identity via the chip's border and
  background tint.
- `Flourish`'s `preserveAspectRatio="none"` intentionally lets its line
  segments stretch to fill their container, but with no width limit
  outside the footer, the decorative curl in the middle stretched into a
  flattened smear on any wide page. It now caps its own width by default
  via a real `maxWidth` prop, rather than depending on a class passed in
  from the page using it (which, same as the `EntryCard` fix above,
  compiles with the wrong component's scope attribute and never matched).
- Giscus was hardcoded to `dark_dimmed` regardless of the site's actual
  theme, producing a dark comment box on a light-mode page. It now embeds
  with the resolved light/dark theme and updates live when ThemeToggle
  changes it.
- No `prefers-reduced-motion` handling existed anywhere (card hover lift,
  the new candle flicker). A global rule now collapses animations and
  transitions to effectively instant for anyone who's asked for that.
- The large end of the type scale (used for `h1`/`h2` in particular) was
  fixed at up to 3.4rem with no responsive range at all - a post title set
  in Cormorant at 54px on a narrow phone read as a wall of text. The top
  four sizes now use `clamp()`, unchanged at desktop widths.
- Every displayed date was formatted with no explicit time zone, which
  uses whichever machine happens to run the build - correct by accident
  in local dev, but GitHub Actions builds in UTC. A release timestamped
  in the evening Mountain time (a very common case) fell on the following
  UTC calendar day, so the deployed site showed it a day later than it
  actually happened. Real timestamped dates (a release's publish date,
  the release list's "last synchronized" line) are now pinned to
  `America/Phoenix`; a blog post's date-only frontmatter value (which the
  date-only ISO 8601 spec parses as midnight UTC, not a real local
  instant) is pinned to UTC instead, which is what actually recovers the
  Y-M-D as written regardless of build machine.
