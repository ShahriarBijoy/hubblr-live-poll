import type { PollSnapshot } from "@poll-request/domain";
import { mutationOptions, useMutation } from "@tanstack/react-query";
import { RATE_LIMITED_MESSAGE } from "../../platform/rate-limit";
import {
	ALREADY_VOTED_MESSAGE,
	POLL_CLOSED_MESSAGE,
	POLL_NOT_FOUND_MESSAGE,
	hideResults,
	type VoteViewResult,
	type VoteViewSnapshot,
} from "./cast-vote.schema";

// The results view uses the ["poll", pollId] prefix too, so one invalidation refreshes both views.
export function voteViewKey(pollId: string): readonly ["poll", string, "vote-view"] {
	return ["poll", pollId, "vote-view"];
}

// What the vote view does after a failed PUT. "keep" leaves the view as it was before the vote, with the pick still
// selected, so a retry is one click. "refetch" means the server state moved under the voter (the cookie is gone, the
// voter already voted, the poll closed, or the poll is gone), so the view reloads it and turns into the new state.
export type VoteFailure = { recovery: "keep" | "refetch"; message: string };

const NOT_SENT: VoteFailure = {
	recovery: "keep",
	message: "The vote did not reach the server. Check your connection and try again.",
};

const FAILURE_BY_STATUS: Partial<Record<number, VoteFailure>> = {
	400: { recovery: "keep", message: "That option is not in this poll. Reload the page and pick again." },
	401: { recovery: "refetch", message: "Your voter cookie was missing or expired. We made a new one. Vote again." },
	404: { recovery: "refetch", message: POLL_NOT_FOUND_MESSAGE },
	409: { recovery: "refetch", message: ALREADY_VOTED_MESSAGE },
	410: { recovery: "refetch", message: POLL_CLOSED_MESSAGE },
	413: { recovery: "keep", message: "The vote did not reach the server. Reload the page and try again." },
	429: { recovery: "keep", message: RATE_LIMITED_MESSAGE },
};

export function failureForStatus(status: number): VoteFailure {
	return FAILURE_BY_STATUS[status] ?? NOT_SENT;
}

export class VoteFailed extends Error {
	constructor(
		readonly failure: VoteFailure,
		readonly status: number | null,
		options?: ErrorOptions,
	) {
		super(failure.message, options);
	}
}

// Every failure, a network error included, comes out as a VoteFailed, so the mutation has one error type.
export async function sendVote(pollId: string, optionId: number): Promise<PollSnapshot> {
	const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ optionId }),
	}).catch((error: unknown) => {
		throw new VoteFailed(NOT_SENT, null, { cause: error });
	});
	if (!response.ok) throw new VoteFailed(failureForStatus(response.status), response.status);
	return (await response.json().catch((error: unknown) => {
		throw new VoteFailed(NOT_SENT, null, { cause: error });
	})) as PollSnapshot;
}

// The view the moment the voter submits. A vote is final, so a vote the server accepts is always a first vote.
export function withVote(snapshot: VoteViewSnapshot, optionId: number): VoteViewSnapshot {
	return {
		...snapshot,
		myOptionId: optionId,
		totalVotes: snapshot.totalVotes + 1,
	};
}

export type CastVoteContext = { previous: VoteViewResult | undefined };

// Plain options, so a test can drive the mutation with a MutationObserver and no React.
export function castVoteMutation(pollId: string) {
	const queryKey = voteViewKey(pollId);
	return mutationOptions<PollSnapshot, VoteFailed, number, CastVoteContext>({
		mutationKey: ["cast-vote", pollId],
		mutationFn: (optionId) => sendVote(pollId, optionId),
		onMutate: async (optionId, { client }) => {
			// A refetch that lands after this write would erase the optimistic vote.
			await client.cancelQueries({ queryKey });
			const previous = client.getQueryData<VoteViewResult>(queryKey);
			if (previous?.kind === "found") client.setQueryData(queryKey, found(withVote(previous.snapshot, optionId)));
			return { previous };
		},
		onError: async (error, _optionId, context, { client }) => {
			client.setQueryData(queryKey, context?.previous);
			if (error.failure.recovery === "refetch") await client.invalidateQueries({ queryKey });
		},
		onSuccess: (snapshot, _optionId, _context, { client }) => {
			client.setQueryData(queryKey, found(hideResults(snapshot)));
		},
	});
}

function found(snapshot: VoteViewSnapshot): VoteViewResult {
	return { kind: "found", snapshot };
}

export function useCastVote(pollId: string) {
	return useMutation(castVoteMutation(pollId));
}

export function voteCountText(totalVotes: number, voted: boolean): string {
	if (totalVotes === 0) return "No votes yet. Be the first to vote.";
	const votes = `${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} so far.`;
	return voted ? votes : `${votes} Vote to see the results.`;
}
