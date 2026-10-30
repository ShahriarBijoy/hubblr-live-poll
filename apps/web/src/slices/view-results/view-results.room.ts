import { countsVisible, pollStatus, type VoterId } from "@poll-request/domain";
import { isAdminTokenHash, type AdminTokenHash } from "../../platform/admin-token";
import type { PollRepository, RoomContext } from "../../poll-room/poll-repository";
import type { ResultsResult } from "./view-results.schema";

export function readResultsInRoom(
	repository: PollRepository,
	voterId: VoterId | null,
	adminTokenHash: AdminTokenHash | null,
	context: RoomContext,
): ResultsResult {
	const stored = repository.load();
	if (stored === null) return { kind: "not-found" };
	const { poll } = stored;
	const myOptionId = voterId === null ? null : repository.voteOf(voterId);
	const role = isAdminTokenHash(stored.adminTokenHash, adminTokenHash)
		? "creator"
		: myOptionId === null
			? "non-voter"
			: "voter";
	const snapshot = repository.snapshot(poll, context, {
		resultsVisible: countsVisible(role, pollStatus(poll, context.now)),
		myOptionId,
	});
	return { kind: "found", snapshot };
}
