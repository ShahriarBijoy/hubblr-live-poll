import type { OptionId, Poll, PollId, Tone } from "./poll";
import { pollStatus, type PollStatus } from "./poll-lifecycle";

export type PollSnapshot = {
	id: PollId;
	question: string;
	options: { id: number; label: string }[];
	tone: Tone;
	status: PollStatus;
	totalVotes: number;
	// null when the visibility rules hide the counts from this viewer.
	results: { counts: Record<number, number>; version: number } | null;
	viewers: number;
	serverNow: number;
	// HTTP responses only. Broadcasts go to many voters, so they cannot carry one voter's choice.
	myOptionId: number | null;
};

export type SnapshotInput = {
	poll: Poll;
	countsByOptionId: Record<number, number>;
	version: number;
	now: number;
	viewers: number;
	resultsVisible: boolean;
	myOptionId: OptionId | null;
};

export function pollSnapshot(input: SnapshotInput): PollSnapshot {
	const options = [...input.poll.options].sort((a, b) => a.position - b.position);
	const counts = Object.fromEntries(options.map((option) => [option.id, input.countsByOptionId[option.id] ?? 0]));
	return {
		id: input.poll.id,
		question: input.poll.question,
		tone: input.poll.tone,
		options: options.map(({ id, label }) => ({ id, label })),
		status: pollStatus(input.poll, input.now),
		totalVotes: Object.values(counts).reduce((total, count) => total + count, 0),
		results: input.resultsVisible ? { counts, version: input.version } : null,
		viewers: input.viewers,
		serverNow: input.now,
		myOptionId: input.myOptionId,
	};
}
