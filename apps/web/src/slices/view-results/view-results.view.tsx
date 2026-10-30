import type { PollSnapshot } from "@poll-request/domain";
import type { LiveStatus } from "@poll-request/ui/poll/live-badge";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useLivePoll, type LiveState } from "../../platform/live-poll";
import { PollNotFound } from "../../platform/poll-page";
import { ResultsCard } from "./view-results.card";
import { mergeLiveSnapshot } from "./view-results.live";
import { resultsQuery } from "./view-results.query";

export { PollNotFound } from "../../platform/poll-page";
export { loadResultsPage } from "./view-results.query";

// "stopped" means the server ended the stream (the poll closed or is gone), so the page shows the last results.
const LIVE_STATUS: Record<LiveState, LiveStatus> = { connecting: "connecting", live: "live", stopped: "offline" };

export function ResultsView({ pollId }: { pollId: string }) {
	const { data } = useSuspenseQuery(resultsQuery(pollId));
	const queryClient = useQueryClient();
	const onSnapshot = useCallback(
		(snapshot: PollSnapshot) => {
			queryClient.setQueryData(resultsQuery(pollId).queryKey, (current) => mergeLiveSnapshot(current, snapshot));
		},
		[queryClient, pollId],
	);
	const live = useLivePoll(pollId, onSnapshot, {
		enabled: data.kind === "found" && data.snapshot.status.kind === "open",
	});
	if (data.kind === "not-found") return <PollNotFound />;
	// The loader redirects a viewer who may not see the counts. This branch is for a refetch that lost the voter cookie.
	if (data.snapshot.results === null) return <Navigate to="/pr/$pollId" params={{ pollId }} />;
	return (
		<ResultsCard snapshot={data.snapshot} counts={data.snapshot.results.counts} liveStatus={LIVE_STATUS[live]} />
	);
}
