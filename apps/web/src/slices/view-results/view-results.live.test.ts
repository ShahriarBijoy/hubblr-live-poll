import { PollId, type PollSnapshot } from "@poll-request/domain";
import { describe, expect, it } from "vitest";
import { mergeLiveSnapshot } from "./view-results.live";
import type { ResultsResult } from "./view-results.schema";

function snapshot(version: number, viewers: number, myOptionId: number | null): PollSnapshot {
	return {
		id: PollId.parse("AbCdEfGhIj"),
		question: "Tabs or spaces?",
		options: [{ id: 1, label: "Tabs" }],
		tone: "flame",
		status: { kind: "open", closesAt: 2_000 },
		totalVotes: version,
		results: { counts: { 1: version }, version },
		viewers,
		serverNow: 1_000,
		myOptionId,
	};
}

const cached: ResultsResult = { kind: "found", snapshot: snapshot(3, 1, 1) };

describe("merging a live snapshot into the results cache", () => {
	it("keeps the cache when the broadcast is older", () => {
		expect(mergeLiveSnapshot(cached, snapshot(2, 5, null))).toBe(cached);
	});

	it("takes a newer broadcast and an equal one, and keeps the voter's choice", () => {
		expect(mergeLiveSnapshot(cached, snapshot(4, 2, null))).toEqual({ kind: "found", snapshot: snapshot(4, 2, 1) });
		expect(mergeLiveSnapshot(cached, snapshot(3, 2, null))).toEqual({ kind: "found", snapshot: snapshot(3, 2, 1) });
	});
});
