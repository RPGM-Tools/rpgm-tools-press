---
title: "AI Pair Programming After the Honeymoon"
description: "What working with an AI coding assistant actually looks like once the novelty wears off and it's just part of the workflow."
pubDate: 2026-07-28
tags: ["ai", "tooling", "workflow"]
category: "ai-projects"
draft: false
---

The first month of using an AI coding assistant seriously, everything feels
like magic. It writes the boilerplate you were dreading, explains an
unfamiliar API in one pass, and turns a vague description into a working
function fast enough that the whole exercise feels a little unfair. Then
the novelty wears off, the daily grind sets in, and what's left is either
a genuinely useful tool or an expensive autocomplete, depending on how you
actually use it.

A few things turned out to matter more than raw model quality once the
honeymoon ended.

## Context is the actual bottleneck

The model isn't guessing about your codebase's conventions from nothing -
it's working from whatever context it's been handed, and most of the bad
output traces back to thin context, not a weak model. A repo with a clear
CLAUDE.md, consistent naming, and a couple of representative examples
nearby gets dramatically better suggestions than the same repo with none
of that. Writing documentation stopped being a chore done for future human
maintainers and became infrastructure the assistant reads on every single
task.

## Verification has to be a habit, not an afterthought

An assistant will confidently produce code that compiles, looks reasonable,
and does the wrong thing in a specific edge case it never considered. That
used to be a mild embarrassment to fix later; now it's cheap to fix
immediately, if you build the habit of actually running the thing before
trusting it. The failure mode isn't "the AI is bad," it's "I stopped
checking because it's usually right," which is a much easier trap to fall
into than it sounds.

## Delegation beats dictation

Describing every line felt safe early on but scaled badly. Handing over a
real problem - "this parser breaks on nested quotes, here's a failing
case" - and letting the assistant explore, propose a fix, and show its
reasoning produced better results than narrating the implementation
myself. The skill that mattered wasn't writing better prompts, it was
learning what to delegate wholesale versus what to keep hands-on.

## The parts that stayed hard

Architecture decisions with long-term consequences, judgment calls about
what a project is even for, and anything where "correct" depends on taste
rather than a test passing - none of that got easier. If anything, having
more implementation bandwidth just moved the bottleneck upstream, to
deciding what's worth building in the first place. That's not a
complaint. It's just where the actual work is now.
