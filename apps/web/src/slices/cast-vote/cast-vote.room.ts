import { decideVote, type OptionId, type PollSnapshot, type VoterId } from "@poll-request/domain";
import type { PollRepository, RoomContext } from "../../poll-room/poll-repository";
import { hideResults, type VoteViewResult } from "./cast-vote.schema";

// "recorded" and "unchanged" both answer 200. They stay apart because only a recorded vote changes what other
// viewers see, so PollRoom broadcasts on "recorded" only.
export type CastVoteResult =
	| { kind: "recorded" | "unchanged"; snapshot: PollSnapshot }
	| { kind: "closed" }
	| { kind: "unknown-option" }
	| { kind: "already-voted" }
	| { kind: "not-found" };

export function castVoteInRoom(
	repository: PollRepository,
	voterId: VoterId,
	optionId: OptionId,
	context: RoomContext,
): CastVoteResult {
	const stored = repository.load();
	if (stored === null) return { kind: "not-found" };
	const { poll } = stored;

	// The response goes to a voter who has just voted, and a voter may see the counts.
	function voted(choice: OptionId): PollSnapshot {
		return repository.snapshot(poll, context, { resultsVisible: true, myOptionId: choice });
	}

	const decision = decideVote(poll, repository.voteOf(voterId), optionId, context.now);
	switch (decision.kind) {
		case "closed":
		case "unknown-option":
		case "already-voted":
			return { kind: decision.kind };
		case "unchanged":
			return { kind: "unchanged", snapshot: voted(decision.optionId) };
		case "record":
			repository.recordVote(voterId, decision.optionId, context.now);
			return { kind: "recorded", snapshot: voted(decision.optionId) };
	}
}

export function voteViewInRoom(repository: PollRepository, voterId: VoterId, context: RoomContext): VoteViewResult {
	const stored = repository.load();
	if (stored === null) return { kind: "not-found" };
	const snapshot = repository.snapshot(stored.poll, context, {
		resultsVisible: false,
		myOptionId: repository.voteOf(voterId),
	});
	return { kind: "found", snapshot: hideResults(snapshot) };
}
