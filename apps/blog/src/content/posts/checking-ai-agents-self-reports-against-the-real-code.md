---
title: "Checking an AI agent's gap list against the real code"
description: "Codex built my AnybandUI adapter with 12 passing tests and listed 30 game fields as unavailable. About 20 were already there. Here's how I caught it."
pubDate: "2026-10-31"
category: "ai-and-harness-tips"
tags: ["ai-agents", "codex", "neo-angband", "anybandui", "code-review", "testing"]
cover: "/covers/checking-ai-agents-self-reports-against-the-real-code.webp"
coverAlt: "A brass balance scale on a candlelit desk: a scroll with a green wax seal on one pan, a stack of heavy ledgers and a magnifying glass on the other, a quill in an inkwell beside it."
draft: false
---

About 20 of the 30 fields Codex told me were unavailable were already being published by the game. Codex, OpenAI's coding agent, had written the first pass of an adapter for AnybandUI in a few minutes, and the tests were green: I re-ran `pnpm verify` myself and got 12 passing tests. The list of missing fields came back alongside the code, and it looked just as solid.

Those 12 tests covered the code. They had nothing to say about whether the game really lacked those fields, and that part of the report was wrong. I caught it on September 26th by reading the game's own source, and since then I check anything an agent claims about the world outside its code against that world, whatever the tests say.

## What Codex reported on the AnybandUI adapter

AnybandUI is a new interface for Neo Angband, my browser port of the classic roguelike Angband. Phase 0 is the adapter, the layer that reads the game's state so the UI can show it. Nothing in AnybandUI can display a stat or a status effect until the adapter hands it over.

The job started with ChatGPT in the browser. It still hadn't written any code after a while, so it got about seven more minutes, and then the same job went to Codex, which can read the files directly and run `pnpm verify` itself. That second part mattered to me, because it meant Codex could run the checks on its own work before handing it back.

Codex was fast. The first pass came back in a few minutes with 12 passing tests. It also came back with a list of 30 fields it said the game didn't expose yet. Taken at face value, that list meant new work in Neo Angband's core before the UI could show any of them.

## What was actually in the game

Checking the adapter against the game's source turned up the problem. The game publishes a HUD frame, the data behind its on-screen status display, and about 20 of those 30 fields were already in it, ready for the adapter to read.

The status badges were off too. A player glancing at one would have seen "PROTEVIL", which is how the game's source spells Protection from Evil and not anything it ever puts on screen. Reading the code behind the badges wasn't much better, since it was dense and hard to follow.

None of that showed up in the test run. The tests compared the code to Codex's own picture of the game, and "unavailable" was part of that picture, so the suite had no way to object. The claim sat in a tidy list next to working code, and I almost read it as a finding. All it really told me was where Codex had looked. Only fields that are truly missing should become feature requests against the core game, and at that point I didn't know which ones those were.

## How it ended

I sent it back to Codex, and the rework fixed both problems. The adapter now reads every field the HUD frame publishes, including the 20 that were supposedly missing. The badges use the same wording the game shows a player, so PROTEVIL is gone. The character name and the message history get pulled from the game state read-only, which means the UI displays them and never writes anything back.

That took the gap list from 30 fields down to 10. Those 10 are things the game really doesn't publish yet, like the flag behind the `-more-` prompt and the long descriptions for status effects. They're the ones worth turning into feature requests against the core game. The purity test passes against a real booted game, and Phase 0 is committed locally.

## What I check now

- When an agent says something is unavailable, can't be done, or needs new plumbing, I search for it by name in the data source that already exists. That one look turned two-thirds of the Codex gap list into work that was already done.
- When an agent says tests pass, I run the real suite myself before I read anything else in the report.
- When the tests are green, I still compare the agent's claims about the outside world (the game, the bug, the API) against that world, because the tests only measure the code against its own assumptions.
