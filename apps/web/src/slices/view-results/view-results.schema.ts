import type { PollSnapshot } from "@poll-request/domain";

// Section 16 text. Cast-vote has the same constant, and slices cannot import each other.
export const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";

// `results` in the snapshot is null when the visibility rules hide the counts from this viewer.
export type ResultsResult = { kind: "found"; snapshot: PollSnapshot } | { kind: "not-found" };
