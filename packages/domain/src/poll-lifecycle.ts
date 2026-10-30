import type { Poll } from "./poll";

export type ClosedBy = "creator" | "timer";

export type PollStatus = { kind: "open"; closesAt: number } | { kind: "closed"; closedAt: number; closedBy: ClosedBy };

export function pollStatus(poll: Poll, now: number): PollStatus {
	if (poll.closedAt !== null) return { kind: "closed", closedAt: poll.closedAt, closedBy: "creator" };
	return statusAt({ kind: "open", closesAt: poll.closesAt }, now);
}

// The status at `now` of a poll that had `status` earlier. Only the timer can close a poll without a new status from
// the server, so the client can tick an open status into a timer close with the same rule the server uses.
export function statusAt(status: PollStatus, now: number): PollStatus {
	if (status.kind === "open" && now >= status.closesAt) {
		return { kind: "closed", closedAt: status.closesAt, closedBy: "timer" };
	}
	return status;
}

// The poll data stays seven days after the close, then the alarm deletes it.
export const RETENTION_MS = 7 * 86_400_000;

export type AlarmStep = { kind: "wait"; until: number } | { kind: "export" } | { kind: "delete" };

// Each step comes from the stored data and `now` only, so a second run of the alarm takes the same step.
export function alarmStep(poll: Poll, summaryExportedAt: number | null, now: number): AlarmStep {
	const status = pollStatus(poll, now);
	if (status.kind === "open") return { kind: "wait", until: status.closesAt };
	if (summaryExportedAt === null) return { kind: "export" };
	const deleteAt = status.closedAt + RETENTION_MS;
	return now >= deleteAt ? { kind: "delete" } : { kind: "wait", until: deleteAt };
}

export type CloseDecision = { kind: "close"; closedAt: number } | { kind: "already-closed" };

// A poll the timer closed keeps closed_at empty: the CHECK forbids a closed_at after closes_at.
export function decideClose(poll: Poll, now: number): CloseDecision {
	return pollStatus(poll, now).kind === "open" ? { kind: "close", closedAt: now } : { kind: "already-closed" };
}
