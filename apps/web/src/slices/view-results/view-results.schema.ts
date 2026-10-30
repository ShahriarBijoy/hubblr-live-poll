import type { PollSnapshot } from "@poll-request/domain";

// cast-vote repeats this message, because slices cannot import each other.
export const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";

// `results` in the snapshot is null when the visibility rules hide the counts from this viewer.
export type ResultsResult = { kind: "found"; snapshot: PollSnapshot } | { kind: "not-found" };
