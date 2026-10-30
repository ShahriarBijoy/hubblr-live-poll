import { pollDurationSec, type Poll, type PollId } from "./poll";
import type { ClosedBy, PollStatus } from "./poll-lifecycle";

export type PollSummary = {
	pollId: PollId;
	createdAt: number;
	durationSec: number;
	closesAt: number;
	optionCount: number;
} & (
	| { closedAt: null; closedBy: null; totalVotes: null; counts: null }
	| { closedAt: number; closedBy: ClosedBy; totalVotes: number; counts: number[] }
);

export function pollSummary(poll: Poll, status: PollStatus, countsByOptionId: Record<number, number>): PollSummary {
	const known = {
		pollId: poll.id,
		createdAt: poll.createdAt,
		durationSec: pollDurationSec(poll),
		closesAt: poll.closesAt,
		optionCount: poll.options.length,
	};
	if (status.kind === "open") {
		return { ...known, closedAt: null, closedBy: null, totalVotes: null, counts: null };
	}
	const counts = [...poll.options]
		.sort((a, b) => a.position - b.position)
		.map((option) => countsByOptionId[option.id] ?? 0);
	return {
		...known,
		closedAt: status.closedAt,
		closedBy: status.closedBy,
		totalVotes: counts.reduce((total, count) => total + count, 0),
		counts,
	};
}
