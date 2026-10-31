---
title: "Picturing My Gut Feeling as a Tool for an AI Agent"
description: "A musing on \"go with your gut\": I picture my gut as one tool an AI agent calls, then add the contract, a friend's opinion, and a cheap test before deciding."
pubDate: "2026-10-31"
category: "musings"
tags: ["musing", "decision-making", "mcp", "ai-agents"]
cover: "/covers/gut-feelings-as-an-mcp-server.webp"
coverAlt: "A candlelit workbench where a small glowing brass lantern, wired to a clockwork machine, sits among a balance scale, an open ledger, a magnifying glass, and two little advisor automatons, all consulted on the same question as the gut."
draft: false
---

People hand out "go with your gut" like it settles things, and lately I picture it as an AI agent with exactly one tool wired up. The job offer goes to that tool. So does the party, and the car, and the fish at dinner. Whatever comes back, the agent does.

For anyone who hasn't wired one up, an MCP server is a small service an AI agent can call through a standard interface, the Model Context Protocol. Each one handles one kind of question. One checks the weather, another reads a calendar, another searches a folder of files. The agent decides when to call it and what to do with the answer.

Picture the gut, then, as a server with one tool on it: `gut.feel`. I'm usually halfway through describing a situation when it answers "nope," confidence 0.94. Setup took no API key. It has never billed me, and it has never rate-limited me either. What it learned from is my life so far (years of awkward dinners, at least one bad haircut), and none of that data was ever cleaned.

I like this tool. I'd keep it in any config. The trouble is a setup where it's the only tool, because then every problem turns into a call to `gut.feel`, and whatever it returns ships straight to production.

Say a job offer shows up. This one is made up. `gut.feel` comes back with a loud yes, and if it gave reasons at all, they'd be the big office windows and the interviewer who laughed at my joke. The one-tool agent takes that yes and signs. Nobody reads the contract or checks the commute, and the friend of a friend who works there never gets a message. Months later it goes sideways, I want to know why the gut said yes, and there are no logs. Calling it again just returns a 200 OK with an empty body.

It has other quirks you'd recognize from any service you've integrated. It caches aggressively, so it will happily answer today's question with a response it computed for a different situation ten years ago. It will also return a confident answer to a question it has never seen before, with no warning label at all, which anyone who has built with language models will find a little familiar.

I'd rather run a different agent. Mine still calls the gut first, since that call costs nothing, but it doesn't stop there. Next it fetches the salary numbers, then the contract, then whatever reviews it can find. A friend gets asked, or somebody who has done that kind of job, because their gut learned from a different life than mine. If they disagree with my gut, that's the cue to go find a third opinion. Some decisions come with a cheap test, like renting in a neighborhood before buying there or driving the car around the block, and those get run. After the choice is made, it goes back and checks the result, the same way I'd run the test suite instead of believing a commit message that says "fixed."

That's a lot more calls than one, and most of them are slower and more annoying than asking the gut. The gut's answer still goes into the decision, as one input with a decent track record and two known bugs (the stale cache and the confidence on questions it has never seen), sitting alongside everything else.

Sometimes all of it comes back and the gut was right the whole time. The contract was fair, the friend loves working there, and the commute is short. Those are the nice days, and the gut's yes now has some evidence attached.

My version of "go with your gut," then, is to use your gut as an MCP server. I call it early because it's quick, and after that I go call everything else.

Lunch is where I skip all of that and order whatever `gut.feel` returns.
