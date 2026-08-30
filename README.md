# RPGM Tools Press

A small publishing monorepo hosting two static sites:

- **[apps/blog](apps/blog)** - "Relics & Reckonings", a personal dev blog at
  [blog.rpgm.tools](https://blog.rpgm.tools).
- **[apps/releases](apps/releases)** - an automated aggregator of release
  notes across the maintainer's repositories, at
  [releases.rpgm.tools](https://releases.rpgm.tools).

Both sites are built with [Astro](https://astro.build) and deployed as
Cloudflare Workers serving static assets. They share one visual/component
system, [packages/theme](packages/theme), and each applies its own skin on
top of it.

## Development

```bash
pnpm install
pnpm --filter blog dev
pnpm --filter releases dev
```

## Comments

Both apps support GitHub Discussions-backed comments via
[giscus](https://giscus.app), gated behind a real Discussion category ID set
in each app's `src/consts.ts` (`GISCUS.categoryId`). A placeholder ID leaves
the widget unrendered rather than showing a broken embed.

## Search

Listing pages have one inline search field that filters the entries already
rendered in the body; results never move out of reverse-chronological order.
Tier one uses [Pagefind](https://pagefind.app)'s plain JavaScript API and its
postbuild index (`astro build && pagefind --site dist`) to match full entry
text, then maps matching page URLs back to the existing cards/ledger rows.
Because that index only exists after postbuild, exercise full-text search
against a real build rather than `astro dev`.

Only when Pagefind finds no entry on the current listing does tier two run.
One normalized Qwen3 embedding per entry lives in each app's committed
`public/search-embeddings.json`; the browser sends the novel query text to
that site's `/api/search-embedding` Worker route, then ranks the in-scope
static vectors locally by cosine similarity. If Workers AI is unavailable,
the page stays usable and reports no related results. The stable header
Search link (and `/` shortcut) focuses the local field when one exists or
navigates from a detail/About page to `/#entry-search`, so it never expands
or renders a separate results drawer.

Regenerate vectors after changing content with:

```bash
node .github/scripts/generate-search-embeddings.mjs all
```

The command requires `CLOUDFLARE_ACCOUNT_ID` plus either
`CLOUDFLARE_API_TOKEN` or a working `wrangler auth token` login, and reuses
vectors whose content hash is unchanged. CI runs the offline `--check` mode;
the releases sync regenerates and commits changed release vectors, while the
blog deploy refreshes its artifact before building.

## Theme

Light/dark/system, toggled from the header. Defaults to system - no
stored choice means an unvisited reader's OS preference decides, via
`prefers-color-scheme` in `tokens/base.css`. Clicking the toggle stores an
explicit `light`/`dark` choice in `localStorage` (`rpgm-theme`) that wins
over the OS setting from then on; a pre-paint inline script in `Layout`
applies a stored choice before first render so there's no flash of the
other theme. An app's own `skin.css` may override tokens per theme, but
each override must be gated to the same "is this theme actually active"
condition base.css itself uses (see the gated blocks in either app's
`skin.css`) - CSS layers ignore selector specificity, so an ungated
`:root` rule in the skin layer always wins regardless of which theme is
actually showing.

## Release notes sync

`.github/scripts/sync-releases.mjs` populates `apps/releases/src/content/releases`
on a schedule and on push - it is not a live read at request time, so a new
release can take up to the sync interval to appear. Only a strict `vX.Y.Z` tag
is synced, whether it comes from a real GitHub Release (currently the core
game) or, for a repo with no formal Releases at all (currently every mod,
where a version tag IS the release), from the repo's tags directly. GitHub's
own `prerelease` flag is deliberately not used as the filter - it also marks
every pre-1.0 version true, and that history is real, not noise. Either way,
the notes shown are that version's own section of `CHANGELOG.md` at that tag,
not a GitHub Release's `body` - the sync script never hand-edits `CHANGELOG.md`
in the source repos, it only reads from them. Sort order on the site uses each
entry's real publish/commit timestamp, not the changelog heading's day-only
date, so same-day releases still land in the order they were actually
published.

Each tracked repo in `apps/releases/repos.json` carries a `kind` (`core` or
`mod`), an `emoji`, and a `color`, all mirrored from that repo's own
`discord-announce.mjs` `REPO_CONFIG` so the same identity marks a product on
both Discord and here. `color` renders as a thin accent tick per entry in the
release list (`LedgerRow`, a ruled register rather than the blog's card
list - a deliberately different visual language for a changelog aggregator
vs. a personal blog) and as a repo's mark on `/repos`, which lists every
tracked repo and links to its own `/repos/<repo>` page.

A release-listing card's blurb comes from a short AI-synthesized summary of
that version's changelog section (MiniMax-M3, requires `MINIMAX_API_KEY`),
generated once when the entry is first synced and stored in its frontmatter
- a tag's content never changes, so later syncs reuse the stored summary
rather than paying for a fresh call. Without a key, or if a call fails, a
card falls back to a plain first-line truncation of the changelog instead.

## Structure

```
packages/theme/    shared Astro components + design tokens (never forked per app)
apps/blog/          the personal blog
apps/releases/       the release-notes aggregator (content generated by
                     .github/scripts/sync-releases.mjs, do not hand-edit)
```

## Branding

Each app has its own logo (`public/logo.webp`), shown in the header and as
the favicon, passed into `Layout`/`Header` via that app's `SITE_LOGO` const.
The footer's top row shows the site's own name plus its RSS feed and
source-repo links - never a "(c) Year <site name>" line, since a site's own
display name isn't a copyright holder. The actual copyright lives in its
own centered block below: a larger RPGM Tools emblem
(`public/rpgm-tools-logo.webp`, duplicated per app since each deploys its own
static assets) stacked above a "Copyright RPGM Tools, LLC" line, linking to
[rpgm.tools](https://rpgm.tools).

Blog posts carry one `category` (see `CATEGORY_META` in `apps/blog/src/consts.ts`)
shown as a solid-tinted chip ahead of their plain tag chips, both on post
cards and the post page itself - reusing that category's own color anywhere
it already carries an established identity (neo-angband reuses that repo's
own accent from `apps/releases/repos.json`) rather than inventing a new one.

See [AI_USAGE_POLICY.md](AI_USAGE_POLICY.md) for this project's AI use disclosure.
