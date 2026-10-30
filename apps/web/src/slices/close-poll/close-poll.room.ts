import { decideClose, type PollSnapshot } from "@poll-request/domain";
import { isAdminTokenHash, type AdminTokenHash } from "../../platform/admin-token";
import type { PollRepository, RoomContext } from "../../poll-room/poll-repository";

export type ClosePollResult = { kind: "closed"; snapshot: PollSnapshot } | { kind: "forbidden" } | { kind: "not-found" };

export function closePollInRoom(
	repository: PollRepository,
	adminTokenHash: AdminTokenHash,
	context: RoomContext,
): ClosePollResult {
	const stored = repository.load();
	if (stored === null) return { kind: "not-found" };
	if (!isAdminTokenHash(stored.adminTokenHash, adminTokenHash)) return { kind: "forbidden" };
	const decision = decideClose(stored.poll, context.now);
	const poll = decision.kind === "close" ? { ...stored.poll, closedAt: decision.closedAt } : stored.poll;
	if (decision.kind === "close") repository.closePoll(decision.closedAt);
	return { kind: "closed", snapshot: repository.snapshot(poll, context, { resultsVisible: true, myOptionId: null }) };
}
