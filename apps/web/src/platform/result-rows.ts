import { tally, type PollSnapshot } from "@poll-request/domain";
import type { PollResult } from "@poll-request/ui/poll/result-bar";

// The rows keep the snapshot's position order, so they never jump on a live update. The percents come from the
// domain's largest remainder tally, so they add up to 100 in every view.
export function resultRows(options: PollSnapshot["options"], counts: Record<number, number>): PollResult[] {
	const votes = options.map((option) => counts[option.id] ?? 0);
	const { percents } = tally(votes);
	return options.map((option, index) => ({
		id: String(option.id),
		label: option.label,
		votes: votes[index] ?? 0,
		percent: percents[index] ?? 0,
	}));
}
