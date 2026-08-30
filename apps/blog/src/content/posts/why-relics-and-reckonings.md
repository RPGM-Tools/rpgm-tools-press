---
title: "Why Relics & Reckonings"
description: "The reasoning behind starting a blog: a place for the workshop notes that don't fit anywhere else."
pubDate: 2026-07-14
tags: ["meta", "writing"]
category: "dev-musings"
draft: false
---

Every workshop accumulates two kinds of things: the relics you built on
purpose, and the reckonings you only understand after the fact, once
something has broken enough times to teach you what it actually is. This
blog is where both of those get written down.

For a while, the notes lived nowhere in particular. A design decision got
made in a chat session and never left it. A bug got fixed and the reasoning
evaporated the moment the commit landed. A tool got built, worked, and then
sat there being useful without anyone outside the workshop knowing it
existed. That's a fine way to get things done, but it's a bad way to keep
any of it.

So: a blog, self-hosted, statically built, deployed to Cloudflare
alongside the rest of the RPGM Tools suite. Nothing exotic. Markdown files
in, HTML out, an RSS feed for anyone who'd rather read it that way. The
whole point is durability, not spectacle - the kind of place a post from
a year ago is still findable and still correct, or at least honestly
marked as out of date.

## What actually shows up here

Three shapes of post, roughly:

- **Dev logs** - what got built, what broke, what the fix actually was.
  Neo Angband work fits here often, since a roguelike port turns up an
  unreasonable number of small, specific lessons about parsers, RNG state,
  and pretending a 1987 C codebase is easy to reason about.
- **AI/tooling notes** - the practical end of working with AI-assisted
  development day to day: what a given workflow gets right, where it
  quietly lies to you, and what changed between one model generation and
  the next.
- **RPGM Tools progress** - the suite this blog itself belongs to. New
  tools, changed plans, the occasional retired idea.

No lorem ipsum, no placeholder filler - if a post is here, it's because
there was something specific enough to say. The tagline calls out "the
occasional dragon," and that's not really a joke: Neo Angband has dragons
in it, and sooner or later one of them is going to end up as a footnote in
a post about something else entirely.

## The mechanics, briefly

The site is an Astro static build, themed with a shared component package
so the blog and the future releases site look like they belong to the same
publisher instead of two unrelated experiments. Search will come later,
once there's enough here to be worth searching. For now: three posts, a
tag page, an archive, and a feed. It starts small on purpose.
