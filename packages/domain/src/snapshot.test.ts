import { describe, expect, it } from "vitest";
import { CreatePollCommand, createPoll, pollSnapshot } from "./index";

const NOW = 1_700_000_000_000;

const poll = createPoll(
	CreatePollCommand.parse({
		id: "abcDEF_-12",
		question: "Tabs or spaces?",
		options: ["Tabs", "Spaces", "Whatever the linter says"],
		durationSec: 300,
		tone: "flame",
	}),
	NOW,
);

const view = { poll, version: 0, now: NOW + 1_000, viewers: 2, myOptionId: null };

describe("pollSnapshot", () => {
	it("shows a zero count for every option of a new poll when the counts are visible", () => {
		expect(pollSnapshot({ ...view, countsByOptionId: {}, resultsVisible: true })).toEqual({
			id: "abcDEF_-12",
			question: "Tabs or spaces?",
			options: [
				{ id: 1, label: "Tabs" },
				{ id: 2, label: "Spaces" },
				{ id: 3, label: "Whatever the linter says" },
			],
			tone: "flame",
			status: { kind: "open", closesAt: NOW + 300_000 },
			totalVotes: 0,
			results: { counts: { 1: 0, 2: 0, 3: 0 }, version: 0 },
			viewers: 2,
			serverNow: NOW + 1_000,
			myOptionId: null,
		});
	});

	it("keeps the total but holds back the counts when the counts are hidden", () => {
		const snapshot = pollSnapshot({ ...view, countsByOptionId: { 1: 3, 3: 1 }, resultsVisible: false });
		expect(snapshot.totalVotes).toBe(4);
		expect(snapshot.results).toBeNull();
	});
});
