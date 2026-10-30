import { describe, expect, it } from "vitest";
import { CastVoteRequest, CreatePollCommand, OptionId, createPoll, decideVote, type VoteDecision } from "./index";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

const command = { id: "abcDEF_-12", question: "Ship it?", options: ["Yes", "No", "Later"], durationSec: 3600, tone: "flame" };
const poll = createPoll(CreatePollCommand.parse(command), NOW);
const merged = { ...poll, closedAt: NOW + 60_000 };

const option = (id: number) => OptionId.parse(id);

describe("decideVote", () => {
	it.each<[string, OptionId | null, number, number, VoteDecision]>([
		["records a first vote", null, 2, NOW, { kind: "record", optionId: option(2) }],
		["refuses a switch to another option", option(1), 2, NOW, { kind: "already-voted" }],
		["keeps the same choice unchanged", option(2), 2, NOW, { kind: "unchanged", optionId: option(2) }],
		["accepts a vote 1 ms before closesAt", null, 3, NOW + HOUR - 1, { kind: "record", optionId: option(3) }],
		["refuses an option that is not in the poll", null, 4, NOW, { kind: "unknown-option" }],
		["refuses a vote exactly at closesAt", null, 2, NOW + HOUR, { kind: "closed" }],
		["refuses a vote after closesAt", option(2), 2, NOW + 2 * HOUR, { kind: "closed" }],
		["answers closed before it looks at the option", null, 4, NOW + HOUR, { kind: "closed" }],
	])("%s", (_name, current, optionId, now, expected) => {
		expect(decideVote(poll, current, option(optionId), now)).toEqual(expected);
	});

	it("refuses a vote on a poll the creator closed, before closesAt", () => {
		expect(decideVote(merged, null, option(1), NOW + 61_000)).toEqual({ kind: "closed" });
	});
});

describe("CastVoteRequest", () => {
	it("accepts a positive integer option ID and refuses anything else", () => {
		expect(CastVoteRequest.safeParse({ optionId: 2 }).success).toBe(true);
		expect(CastVoteRequest.safeParse({ optionId: 0 }).success).toBe(false);
		expect(CastVoteRequest.safeParse({ optionId: 1.5 }).success).toBe(false);
		expect(CastVoteRequest.safeParse({ optionId: "2" }).success).toBe(false);
		expect(CastVoteRequest.safeParse(undefined).success).toBe(false);
	});
});
