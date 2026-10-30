import type { PollSnapshot } from "@poll-request/domain";

// Messages that both the REST errors and the vote view show.
export const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";
export const POLL_CLOSED_MESSAGE = "This poll is closed. Here are the final results.";
export const ALREADY_VOTED_MESSAGE = "You already voted in this poll.";

// The snapshot as the vote view may hold it. The vote view never shows per-option counts, even to a voter who voted,
// and its data reaches the HTML in the dehydrated query cache. `results` is the literal null, so a PollSnapshot with
// counts does not type-check here, and hideResults() is the only way to produce one.
export type VoteViewSnapshot = Omit<PollSnapshot, "results"> & { results: null };

export type VoteViewResult = { kind: "found"; snapshot: VoteViewSnapshot } | { kind: "not-found" };

export function hideResults(snapshot: PollSnapshot): VoteViewSnapshot {
	return { ...snapshot, results: null };
}
