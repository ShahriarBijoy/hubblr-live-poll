import { describe, expect, it } from "vitest";
import { CreatePollCommand, createPoll, pollStatus, pollSummary } from "./index";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const poll = createPoll(
	CreatePollCommand.parse({
		id: "abcDEF_-12",
		question: "Which secret plan wins?",
		options: ["Plan alpha", "Plan beta", "Plan gamma"],
		durationSec: 86400,
		tone: "flame",
	}),
	NOW,
);

const rowColumns = [
	"pollId",
	"createdAt",
	"durationSec",
	"closesAt",
	"optionCount",
	"closedAt",
	"closedBy",
	"totalVotes",
	"counts",
];

describe("pollSummary", () => {
	it("leaves the closing fields empty while the poll is open", () => {
		expect(pollSummary(poll, pollStatus(poll, NOW), {})).toEqual({
			pollId: "abcDEF_-12",
			createdAt: NOW,
			durationSec: 86400,
			closesAt: NOW + DAY,
			optionCount: 3,
			closedAt: null,
			closedBy: null,
			totalVotes: null,
			counts: null,
		});
	});

	it("gives the final counts by option position after the timer closes the poll", () => {
		const summary = pollSummary(poll, pollStatus(poll, NOW + DAY), { 1: 4, 3: 2 });
		expect(summary).toMatchObject({ closedAt: NOW + DAY, closedBy: "timer", totalVotes: 6, counts: [4, 0, 2] });
	});

	it("records an early close by the creator", () => {
		const merged = { ...poll, closedAt: NOW + 5_000 };
		const summary = pollSummary(merged, pollStatus(merged, NOW + 6_000), { 2: 1 });
		expect(summary).toMatchObject({
			closesAt: NOW + DAY,
			closedAt: NOW + 5_000,
			closedBy: "creator",
			totalVotes: 1,
			counts: [0, 1, 0],
		});
	});

	it("holds only counts and timestamps, never the poll text", () => {
		const summary = pollSummary(poll, pollStatus(poll, NOW + DAY), { 1: 1 });
		expect(Object.keys(summary).sort()).toEqual([...rowColumns].sort());
		const serialized = JSON.stringify(summary);
		for (const text of [poll.question, ...poll.options.map((option) => option.label)]) {
			expect(serialized).not.toContain(text);
		}
	});
});
