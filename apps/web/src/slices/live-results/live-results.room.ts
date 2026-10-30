import { pollStatus, type PollSnapshot, type VoterId } from "@poll-request/domain";
import { isAdminTokenHash, type AdminTokenHash } from "../../platform/admin-token";
import type { PollRepository, RoomContext } from "../../poll-room/poll-repository";
import type { LiveRole } from "./live-ticket";

export type PollState = "open" | "closed" | "not-found";

export type LiveAccess = { kind: "ok"; role: LiveRole } | { kind: "not-voted" | "closed" | "not-found" };

export function pollStateInRoom(repository: PollRepository, now: number): PollState {
	const stored = repository.load();
	if (stored === null) return "not-found";
	return pollStatus(stored.poll, now).kind;
}

export function liveAccessInRoom(
	repository: PollRepository,
	voterId: VoterId | null,
	adminTokenHash: AdminTokenHash | null,
	context: RoomContext,
): LiveAccess {
	const stored = repository.load();
	if (stored === null) return { kind: "not-found" };
	const role = isAdminTokenHash(stored.adminTokenHash, adminTokenHash)
		? "creator"
		: voterId !== null && repository.voteOf(voterId) !== null
			? "voter"
			: null;
	if (role === null) return { kind: "not-voted" };
	return pollStatus(stored.poll, context.now).kind === "closed" ? { kind: "closed" } : { kind: "ok", role };
}

// Only voters and the creator get a ticket, so every socket may see the counts. The snapshot goes to all of them, so it carries no
// voter's choice.
export function liveSnapshotInRoom(repository: PollRepository, context: RoomContext): PollSnapshot | null {
	const stored = repository.load();
	if (stored === null) return null;
	return repository.snapshot(stored.poll, context, { resultsVisible: true, myOptionId: null });
}
