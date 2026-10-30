import { CreatePollCommand, OptionId, createPoll, pollSnapshot, type Poll } from "@poll-request/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hideResults } from "./cast-vote.schema";
import { VoteCard } from "./cast-vote.card";

const NOW = 1_793_000_000_000;
const command = { id: "AbCdEfGhIj", question: "Tabs or spaces?", options: ["Tabs", "Spaces"], durationSec: 3600, tone: "flame" };
const poll = createPoll(CreatePollCommand.parse(command), NOW);

// Four-digit counts cannot collide with the digits of the countdown.
function renderedVoteCard(state: Poll, myOptionId: OptionId | null): string {
	const snapshot = pollSnapshot({
		poll: state,
		countsByOptionId: { 1: 4111, 2: 2777 },
		version: 6888,
		now: NOW + 60_000,
		viewers: 0,
		resultsVisible: true,
		myOptionId,
	});
	return renderToString(
		<QueryClientProvider client={new QueryClient()}>
			<VoteCard pollId={state.id} snapshot={hideResults(snapshot)} onVoted={() => {}} />
		</QueryClientProvider>,
	);
}

describe("the vote view", () => {
	it("shows a voter who voted the question, the total, and the time left, and no count for each option", () => {
		const html = renderedVoteCard(poll, OptionId.parse(2));

		expect(html).toContain("Tabs or spaces?");
		expect(html).toContain("6888");
		expect(html).toContain('aria-label="Voting closes in 59 minutes"');
		expect(html).toContain("Your vote: Spaces.");
		expect(html).not.toContain("4111");
		expect(html).not.toContain("2777");
	});

	it("asks a voter who did not vote to vote", () => {
		expect(renderedVoteCard(poll, null)).toContain("6888 votes so far. Vote to see the results.");
	});

	it("shows the closed text and the link to the final results when the creator closed the poll", () => {
		const html = renderedVoteCard({ ...poll, closedAt: NOW + 30_000 }, OptionId.parse(1));

		expect(html).toContain("Closed by the creator.");
		expect(html).toContain('href="/pr/AbCdEfGhIj/results"');
		expect(html).not.toContain("<form");
	});

	it("shows the timer's closed text once closes_at has passed", () => {
		const html = renderedVoteCard({ ...poll, closesAt: NOW + 30_000 }, null);

		expect(html).toContain("Time is up.");
		expect(html).toContain("See results");
	});
});
