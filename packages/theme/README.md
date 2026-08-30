# @rpgm/tools-press-theme

Shared "dark fantasy grimoire" Astro/CSS theme for RPGM Tools Press sites
(the blog, the releases site, and any future site in this monorepo).

Dark-mode-first: candlelit, earthy, grounded tones built around three
anchor colors - Polished Gold (`#CFA146`), Graphite (`#1F2937`), and a
rust/Fiery-Orange (`#C04100`) - plus a warm parchment-cream, a deep
umber/leather brown, and a muted forest-green as a secondary accent.
Explicitly not bright/flashy purple or pink.

This package has no build step. It is consumed via `workspace:*` and its
`.astro` files are resolved directly out of `src/` by the consuming app's
own Vite/Astro toolchain - there is no `dist/` and nothing to run here.

## Installing

```jsonc
// apps/<your-app>/package.json
{
  "dependencies": {
    "@rpgm/tools-press-theme": "workspace:*"
  }
}
```

## Import paths

Astro components are not bundled through a JS barrel - import them by
their subpath export, including the `.astro`/`.css` extension:

```astro
---
import Layout from "@rpgm/tools-press-theme/components/Layout.astro";
import Header from "@rpgm/tools-press-theme/components/Header.astro";
import Footer from "@rpgm/tools-press-theme/components/Footer.astro";
import Nav from "@rpgm/tools-press-theme/components/Nav.astro";
import EntryCard from "@rpgm/tools-press-theme/components/EntryCard.astro";
import Prose from "@rpgm/tools-press-theme/components/Prose.astro";
import ListFilter from "@rpgm/tools-press-theme/components/ListFilter.astro";

import Flourish from "@rpgm/tools-press-theme/ornaments/Flourish.astro";
import SealGlyph from "@rpgm/tools-press-theme/ornaments/SealGlyph.astro";
---
```

`Layout.astro` already imports the token stylesheets internally, so a page
using `Layout` gets them for free. If you need the tokens without
`Layout` (e.g. in a component-only context), import them directly:

```astro
---
import "@rpgm/tools-press-theme/tokens/base.css";
import "@rpgm/tools-press-theme/tokens/typography.css";
---
```

This subpath shape works because the package's `exports` map is a
pattern export (`"./components/*": "./src/components/*"`, etc) - the
specifier's tail (including its extension) is what gets resolved against
`src/`, which is exactly what Vite's workspace/npm resolution expects.

## Fonts

The theme sets `--rpgm-font-display` (headings) to a `Cormorant`/`EB
Garamond` stack and `--rpgm-font-body` to `EB Garamond`, but does **not**
load the webfont itself - that's left to the consuming app, typically via
`<link>` tags in a page's `<head>` slot:

```astro
<Layout title="..." siteTitle="..." navLinks={links}>
  <Fragment slot="head">
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap"
      rel="stylesheet"
    />
  </Fragment>
  ...
</Layout>
```

If the webfont never loads, the fallback stack (`Georgia, "Times New
Roman", serif`) still reads fine.

## CSS layers

`base.css` declares `@layer rpgm-press-base, rpgm-press-skin;` up front,
so any app-level skin stylesheet using `@layer rpgm-press-skin { ... }`
always overrides these base tokens, regardless of import order.

## Components

- `Layout.astro` - full HTML shell (meta tags, RSS autodiscovery link,
  optional Cloudflare Web Analytics beacon, Header/Footer, `<main>`).
- `Header.astro`, `Footer.astro`, `Nav.astro` - site chrome.
- `EntryCard.astro` - generic list-item card (title/date/description/tags/href).
- `Prose.astro` - typography wrapper for rendered markdown bodies.
- `ListFilter.astro` - inline Pagefind full-text filter with a semantic
  zero-result fallback; it hides existing rows without reordering them.
- `ornaments/Flourish.astro`, `ornaments/SealGlyph.astro` - `currentColor`-based
  decorative SVGs, each accepting optional `color` and `size` props.
