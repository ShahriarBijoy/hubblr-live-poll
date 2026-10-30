import "./zod-config";
import { z } from "zod";
import { OptionId, type Poll } from "./poll";
import { pollStatus } from "./poll-lifecycle";

// The REST body. Whether the option belongs to the poll is a decision, not a format, so it stays out of the schema.
export const CastVoteRequest = z.object({ optionId: OptionId });
export type CastVoteRequest = z.infer<typeof CastVoteRequest>;

export type VoteDecision =
	| { kind: "closed" }
	| { kind: "unknown-option" }
	| { kind: "already-voted" }
	| { kind: "unchanged"; optionId: OptionId }
	| { kind: "record"; optionId: OptionId };

// The status comes first and from `now`, so a vote at or after closesAt is refused also when no alarm ran, and a
// closed poll answers "closed" whatever option the voter sent. A vote is final. The same choice again stays "unchanged",
// so a retry of a vote that reached the server still succeeds.
export function decideVote(poll: Poll, current: OptionId | null, optionId: OptionId, now: number): VoteDecision {
	if (pollStatus(poll, now).kind === "closed") return { kind: "closed" };
	if (!poll.options.some((option) => option.id === optionId)) return { kind: "unknown-option" };
	if (current === optionId) return { kind: "unchanged", optionId };
	if (current !== null) return { kind: "already-voted" };
	return { kind: "record", optionId };
}
