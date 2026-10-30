import { CreatePollCommand, OptionId, createPoll, pollSnapshot, type Poll } from "@poll-request/domain";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultsCard } from "./view-results.card";

const NOW = 1_793_000_000_000;
const command = { id: "AbCdEfGhIj", question: "Tabs or spaces?", options: ["Tabs", "Spaces"], durationSec: 3600, tone: "flame" };
const poll = createPoll(CreatePollCommand.parse(command), NOW);

function renderedResults(counts: Record<number, number>, state: Poll = poll, viewers = 0): string {
	const snapshot = pollSnapshot({
		poll: state,
		countsByOptionId: counts,
		version: 1,
		now: NOW + 60_000,
		viewers,
		resultsVisible: true,
		myOptionId: OptionId.parse(2),
	});
	return renderToString(<ResultsCard snapshot={snapshot} counts={snapshot.results?.counts ?? {}} />);
}

describe("the results view", () => {
	// Four-digit counts cannot collide with the digits of the countdown or the percents.
	it("shows the counts, the percents, the time left and the voter's choice in the HTML", () => {
		const html = renderedResults({ 1: 3000, 2: 1000 });

		expect(html).toContain("Tabs or spaces?");
		expect(html).toContain("Tabs: 3000 votes, 75 percent, leading");
		expect(html).toContain("Spaces: 1000 votes, 25 percent, your vote");
		expect(html).toContain("--fill:max(64px, 75%)");
		expect(html).toContain('aria-label="Voting closes in 59 minutes"');
		expect(html).toContain("You picked Spaces.");
	});

	it.each([
		["the creator closed the poll", { ...poll, closedAt: NOW + 30_000 }, "Closed by the creator."],
		["closes_at has passed", { ...poll, closesAt: NOW + 30_000 }, "Time is up."],
	])("shows the closed text when %s", (_case, state, text) => {
		expect(renderedResults({ 1: 3000, 2: 1000 }, state)).toContain(text);
	});

	it("marks a single leader", () => {
		const html = renderedResults({ 1: 3000, 2: 1000 });

		expect(html).toContain("Tabs is leading.");
		expect(html).not.toContain("Tied at the top.");
	});

	it("shows the tie text when two options lead", () => {
		const html = renderedResults({ 1: 2000, 2: 2000 });

		expect(html).toContain("Tied at the top.");
		expect(html).not.toContain("Tabs is leading.");
	});

	it("shows the zero-vote text when nobody voted", () => {
		const html = renderedResults({});

		expect(html).toContain("No votes yet.");
		expect(html).not.toContain("Tabs is leading.");
	});

	it("shows how many people are watching, and nothing when nobody is", () => {
		expect(renderedResults({ 1: 3000 }, poll, 1)).toContain("1 person watching live");
		expect(renderedResults({ 1: 3000 }, poll, 4)).toContain("4 people watching live");
		expect(renderedResults({ 1: 3000 })).not.toContain("watching live");
	});
});
