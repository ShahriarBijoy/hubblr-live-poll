# How AI was used

I designed this app and directed the AI agents that built it, using Claude Code.

## My role

- **Architecture.** The main architecture is mine: one Durable Object per poll, the server deciding who may see the counts, signed voter cookies and a secret admin link instead of accounts, live results over WebSockets, a summary table that keeps the final numbers after a poll is deleted, and the code split into one folder per feature.
- **Product decisions.** Votes are final. Results show right after voting. The creator picks any time limit from 1 minute to 24 hours. Two scaling fixes ship now, and the bigger ones are written down in [Scaling and cost](scaling-and-cost.md). The look comes from a design system I made in Claude Design, which I later had simplified.
- **Managing the agents.** I split the work into eight small steps, each with a spec and a "done" checklist. Agents built each step from its spec. I reviewed every result and merged it only when it met the checklist.
- **The quality bar.** I set the rule that nothing reaches `main` until it passes the tests, the folder rule check, a test deploy, and a check in the real app.

## How the agents worked

Claude Code wrote the code from my specs, then checked each step on a test copy of the app with `curl`, WebSocket scripts, and a real browser before handing it back to me.

## The checks I required caught real mistakes

- The first guesses about why 1,000 watchers lagged were wrong. One fix changed nothing and was undone. Measuring led to the real fix.
- The cost notes once had a free plan limit wrong by ten times. Checking the price page found it.
- Each screen rounded percentages on its own, so three single votes showed 33/33/33. A browser check caught it.
- A production secret was once set to an empty value. The first check on the live site caught the error.

I set the architecture, managed the agents, and made every product decision.
