import type { PollSnapshot } from "@poll-request/domain";
import type { ResultsResult } from "./view-results.schema";

// Broadcasts can arrive out of order, so an older version never replaces a newer one. An equal version still wins,
// because a viewer count change does not bump the version. Broadcasts carry no voter's choice, so the cached one stays.
export function mergeLiveSnapshot(current: ResultsResult | undefined, incoming: PollSnapshot): ResultsResult | undefined {
	if (current?.kind !== "found") return current;
	if ((incoming.results?.version ?? -1) < (current.snapshot.results?.version ?? 0)) return current;
	return { kind: "found", snapshot: { ...incoming, myOptionId: current.snapshot.myOptionId } };
}
