import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	castVoteMutation,
	failureForStatus,
	voteCountText,
	voteViewKey,
} from "./cast-vote.form";
import type { VoteViewResult, VoteViewSnapshot } from "./cast-vote.schema";

const POLL_ID = "AbCdEfGhIj";

function snapshotWith(change: Partial<VoteViewSnapshot> = {}): VoteViewSnapshot {
	return {
		id: POLL_ID as VoteViewSnapshot["id"],
		question: "Tabs or spaces?",
		options: [
			{ id: 1, label: "Tabs" },
			{ id: 2, label: "Spaces" },
		],
		tone: "flame",
		status: { kind: "open", closesAt: 1_793_000_000_000 },
		totalVotes: 10,
		results: null,
		viewers: 0,
		serverNow: 1_792_999_000_000,
		myOptionId: null,
		...change,
	};
}

function voteView(change: Partial<VoteViewSnapshot> = {}): VoteViewResult {
	return { kind: "found", snapshot: snapshotWith(change) };
}

function seededClient(result: VoteViewResult): QueryClient {
	const queryClient = new QueryClient();
	queryClient.setQueryData(voteViewKey(POLL_ID), result);
	return queryClient;
}

function cached(queryClient: QueryClient): VoteViewResult | undefined {
	return queryClient.getQueryData(voteViewKey(POLL_ID));
}

// A fetch whose answer the test releases, so it can look at the cache while the PUT is on the wire.
function heldFetch(): { answer: (response: Response) => void } {
	let answer: (response: Response) => void = () => {};
	vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => (answer = resolve)));
	return { answer: (response) => answer(response) };
}

function vote(queryClient: QueryClient, optionId: number): Promise<unknown> {
	return new MutationObserver(queryClient, castVoteMutation(POLL_ID)).mutate(optionId).catch((error: unknown) => error);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the vote mutation", () => {
	it("shows a first vote at once, then stores the server's answer without the counts", async () => {
		const queryClient = seededClient(voteView({ totalVotes: 10 }));
		const wire = heldFetch();

		const settled = vote(queryClient, 2);
		await vi.waitFor(() => expect(cached(queryClient)).toMatchObject({ snapshot: { myOptionId: 2, totalVotes: 11 } }));
		const answer = snapshotWith({ totalVotes: 12, myOptionId: 2 });
		wire.answer(Response.json({ ...answer, results: { counts: { 1: 7, 2: 5 }, version: 3 } }));
		await settled;

		expect(cached(queryClient)).toEqual(voteView({ totalVotes: 12, myOptionId: 2 }));
	});

	it.each([503, 429, 400])("puts the previous view back after a %i and asks for nothing new", async (status) => {
		const previous = voteView({ totalVotes: 10, myOptionId: 1 });
		const queryClient = seededClient(previous);
		const wire = heldFetch();

		const settled = vote(queryClient, 2);
		await vi.waitFor(() => expect(cached(queryClient)).toMatchObject({ snapshot: { myOptionId: 2 } }));
		wire.answer(Response.json({ code: "x", message: "x" }, { status }));
		await settled;

		expect(cached(queryClient)).toEqual(previous);
		expect(queryClient.getQueryState(voteViewKey(POLL_ID))?.isInvalidated).toBe(false);
	});

	it.each([401, 404, 409, 410])("puts the previous view back after a %i and marks it for a reload", async (status) => {
		const previous = voteView();
		const queryClient = seededClient(previous);
		const wire = heldFetch();

		const settled = vote(queryClient, 2);
		await vi.waitFor(() => expect(cached(queryClient)).toMatchObject({ snapshot: { myOptionId: 2 } }));
		wire.answer(Response.json({ code: "x", message: "x" }, { status }));
		await settled;

		expect(cached(queryClient)).toEqual(previous);
		expect(queryClient.getQueryState(voteViewKey(POLL_ID))?.isInvalidated).toBe(true);
	});

	it("puts the previous view back and says so when the request never reaches the server", async () => {
		const previous = voteView();
		const queryClient = seededClient(previous);
		vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));

		const error = await vote(queryClient, 2);

		expect(cached(queryClient)).toEqual(previous);
		expect(error).toMatchObject({
			message: "The vote did not reach the server. Check your connection and try again.",
			cause: expect.any(TypeError),
		});
	});
});

describe("vote failures", () => {
	it.each([
		[400, "keep", "That option is not in this poll. Reload the page and pick again."],
		[401, "refetch", "Your voter cookie was missing or expired. We made a new one. Vote again."],
		[404, "refetch", "This poll does not exist. Create a new one?"],
		[409, "refetch", "You already voted in this poll."],
		[410, "refetch", "This poll is closed. Here are the final results."],
		[413, "keep", "The vote did not reach the server. Reload the page and try again."],
		[429, "keep", "Too many requests. Try again in a few seconds."],
		[500, "keep", "The vote did not reach the server. Check your connection and try again."],
	])("answers a %i with %s", (status, recovery, message) => {
		expect(failureForStatus(status)).toEqual({ recovery, message });
	});
});

describe("vote view text", () => {
	it("hides the counts behind a call to vote until the voter votes", () => {
		expect(voteCountText(0, false)).toBe("No votes yet. Be the first to vote.");
		expect(voteCountText(1, false)).toBe("1 vote so far. Vote to see the results.");
		expect(voteCountText(12, false)).toBe("12 votes so far. Vote to see the results.");
		expect(voteCountText(12, true)).toBe("12 votes so far.");
	});
});
