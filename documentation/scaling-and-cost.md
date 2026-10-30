# Scaling and cost

## Load test

Run on 2026-10-29 on a test copy of the app, on Cloudflare's free plan.
The test computer was 52 ms away from the nearest Cloudflare data center.
The test was kept small on purpose, to stay inside the free plan.

| What was tested | Result | Command |
| --- | --- | --- |
| Votes on one poll, 5 to 100 per second | Half of the votes answered in about 50 ms, 99% in under 140 ms | `pnpm load:votes <url>` |
| Votes on one poll, 200 per second | No errors, but the slowest 1% took about 1.1 s | `pnpm load:votes <url>` |
| Were all votes counted? | Yes, 2,250 of 2,250 | `pnpm load:votes <url>` |
| 50 people watching live | A vote reached them in about 70 ms | `node scripts/load/socket-fanout.mjs <url> --sockets 50 --votes 10` |
| 1,000 people watching live | All 1,000 stayed connected and got every vote | `pnpm load:sockets <url>` |
| How fast a vote reaches 1,000 watchers | Half in 0.7 s, 95% in 3.6 s, all in 8.2 s | `pnpm load:sockets <url>` |

What this means:

- Up to 100 votes per second, a vote is as fast as the network allows.
- Around 200 votes per second, one poll starts to queue, because it handles one request at a time. Nothing breaks, it just gets slower.
- With 1,000 people watching one poll, most see a new vote within a second, but the slowest few wait several seconds.

The first 1,000-watcher test found two problems, and both are fixed:

- A vote used to wait until all 1,000 updates were sent. Now it answers first and sends after.
- Every vote used to trigger an update to everyone, up to 5 times a second. Now updates are grouped, and the bigger the audience, the longer the wait between them: from 0.2 seconds up to 1 second at 1,000 watchers.

## Cost

For 20,000 polls, 1 million votes, and 3 million page views a month, the cost is about **$5.75 a month**:
the $5 Workers Paid plan plus about $0.75 for Durable Object requests.
Pages, scripts, and idle live connections cost nothing extra.
The demo runs on the free plan.

Prices from the [Durable Objects pricing page](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Known limits

Each poll lives in one Durable Object. That keeps it simple and safe, but it is also the ceiling for one very busy poll.

| Limit | When you'd notice it | How to fix it later |
| --- | --- | --- |
| One poll handles one vote at a time | Above about 100 votes per second on one poll | Collect votes first, and save them in batches |
| One poll sends every live update itself | With more than about 1,000 people watching one poll | Add helper objects that each send updates to part of the audience |
| Each watcher keeps a connection open | With very large audiences | Let big audiences reload a cached results page every second instead |
| Each vote recounts the whole poll | A poll with thousands of votes reads more data per vote | Keep a running count for each answer |
| No accounts | Someone can clear cookies and vote again | Add Cloudflare Turnstile, or sign-in for polls that need it |
| Rate limits are approximate | A very fast burst gets a few extra requests through | Count requests in a Durable Object |

None of these matter for normal polls. They start to matter at a few thousand people on one poll.
