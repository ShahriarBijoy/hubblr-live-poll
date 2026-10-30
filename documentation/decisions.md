# Decisions

## Assumptions

The brief left a few things open. This is how I read them:

- "Two views" means two screens, vote and results, not two kinds of users.
- Anyone can create a poll, and anyone with the link can vote. There are no accounts.
- Voters see the results right after they vote. The creator can always see them. After the poll closes, everyone can.
- The creator can vote too, like anyone else.
- A vote is final, like on social media.

## Goals added to the brief

These weren't asked for. I added them because without them, a poll is either unsafe or unfinished.

| Added goal | Why |
| --- | --- |
| A time limit per poll | A poll link that never closes can be found and used a year later |
| The creator can close the poll early | The creator needs one control, and it needs to be protected |
| Results stay hidden until you vote | Seeing who is winning changes how people vote |
| Security, with a list of risks | Anyone on the internet can open the link |
| Final numbers are kept after deletion | Deleting old polls shouldn't delete the statistics |
| Measured speed and cost | "It scales" is a claim. Numbers are proof. |

The brief estimates about two hours of work. These added goals are why it took longer.

## Trade-offs

| Choice | Why | What it costs |
| --- | --- | --- |
| One Durable Object per poll | Each poll gets its own database, so votes never clash and polls never slow each other down | One very busy poll has a ceiling (see [Scaling and cost](scaling-and-cost.md)) |
| No accounts | Creating and voting take one click | Someone can clear cookies and vote again |
| Votes can't be changed | Simple to understand, and simple to count | People can't fix a misclick |
| Polls are deleted after 7 days | Little data is kept, and old links stop working | The full results are gone after a week; only the summary stays |
