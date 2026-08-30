---
title: "Porting a 1987 Roguelike Without Losing Its Soul"
description: "Notes from the Neo Angband port: why exact gameplay parity is the goal even when the code underneath gets rebuilt from scratch."
pubDate: 2026-08-11
tags: ["neo-angband", "roguelike", "porting"]
category: "neo-angband"
draft: false
---

Angband has been in continuous development since 1990, itself descended
from Moria, which goes back further still. Porting a game with that much
inherited history to a modern engine raises an obvious question almost
immediately: how much of the old behavior is a *design decision* worth
keeping, and how much is just an artifact of C code written under very
different constraints, worth quietly fixing along the way?

The answer that's worked best: keep gameplay parity as the hard line, and
let everything underneath it move freely. The randomness feels a specific
way because thousands of hours of player experience were tuned against it.
A staircase generates where it generates, a monster's to-hit roll resolves
the way it resolves, an identify scroll behaves exactly as it always has -
none of that is negotiable, because changing it silently would mean
shipping a different game wearing the original's name. But *how* that
behavior gets computed - the parser, the data structures, the module
boundaries - is completely up for grabs, and rebuilding it properly is
most of what a port actually is.

## Warts stay, on purpose

The original C code has quirks that read as bugs out of context: rounding
that goes the "wrong" direction, edge cases in formulas that clearly
weren't intended but that decades of play have since balanced around.
The rule that's worked here is that anything upstream actually ships stays
exactly as upstream ships it, warts included - a port's job is to
reproduce the game, not to improve on it uninvited. If something is
worth fixing, it becomes an opt-in toggle a player can turn on, never a
silent change baked into the default experience.

## Modding needed a real seam, not a patch

The mod system took longer to get right than the port itself. Early
attempts bound mod code too tightly to internal engine state, so a mod
would work until the next refactor quietly broke it. What actually held up
was giving mods a stable, versioned API - a specific set of hooks and
registries the engine promises to keep working - rather than letting mods
reach into engine internals directly. A mod folder is just a folder: one
entry file, the engine handed in as a parameter, no reaching outside its
own boundary. It's a small constraint that turned out to prevent an
entire category of "why did the last update break my favorite mod"
problem before it could start.

## The part that never gets easier

Verifying parity is fundamentally a measurement problem, not a coding
problem. "It feels the same" isn't evidence. What worked was building
actual test harnesses that record specific, checkable outcomes - a fixed
seed producing a fixed dungeon layout, a known combat roll producing a
known result - and diffing those before and after a refactor instead of
trusting a read-through of the diff. A roguelike's whole appeal rests on
its randomness behaving in a very particular, load-bearing way, and that's
exactly the kind of thing that's easy to break without noticing until a
player does.
