import type { PollStatus } from "./poll-lifecycle";

export type ViewerRole = "creator" | "voter" | "non-voter";

// The only hidden cell is a user who did not vote on an open poll.
const COUNTS_VISIBLE: Record<ViewerRole, Record<PollStatus["kind"], boolean>> = {
	creator: { open: true, closed: true },
	voter: { open: true, closed: true },
	"non-voter": { open: false, closed: true },
};

export function countsVisible(role: ViewerRole, status: PollStatus): boolean {
	return COUNTS_VISIBLE[role][status.kind];
}
