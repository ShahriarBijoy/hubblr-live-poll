import {
	createPoll,
	decideCreate,
	pollStatus,
	pollSummary,
	type CreatePollCommand,
	type Poll,
	type PollSnapshot,
	type PollSummary,
} from "@poll-request/domain";
import type { AdminTokenHash } from "../../platform/admin-token";
import type { PollRepository, RoomContext } from "../../poll-room/poll-repository";

export type CreatePollResult =
	| { kind: "created" | "replayed"; snapshot: PollSnapshot; summary: PollSummary }
	| { kind: "conflict" };

export function createPollInRoom(
	repository: PollRepository,
	command: CreatePollCommand,
	adminTokenHash: AdminTokenHash,
	context: RoomContext,
): CreatePollResult {
	function opened(kind: "created" | "replayed", poll: Poll): CreatePollResult {
		return {
			kind,
			// The response goes to the creator, and the creator always sees the counts.
			snapshot: repository.snapshot(poll, context, { resultsVisible: true, myOptionId: null }),
			summary: pollSummary(poll, pollStatus(poll, context.now), repository.countsByOptionId()),
		};
	}

	const decision = decideCreate(repository.load(), command, adminTokenHash);
	switch (decision.kind) {
		case "conflict":
			return { kind: "conflict" };
		case "replay":
			return opened("replayed", decision.poll);
		case "create": {
			const poll = createPoll(command, context.now);
			repository.insert({ poll, adminTokenHash });
			return opened("created", poll);
		}
	}
}
