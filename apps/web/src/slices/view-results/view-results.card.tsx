import { statusAt, type PollSnapshot } from "@poll-request/domain";
import type { LiveStatus } from "@poll-request/ui/poll/live-badge";
import { ResultsView } from "@poll-request/ui/poll/views/results-view";
import { CLOSED_TEXT, pollCountdown, useServerClock, useShareUrl } from "../../platform/poll-page";
import { resultRows } from "../../platform/result-rows";

// Apart from the query module, whose server function needs the TanStack Start build, so a test can render the card
// with a seeded snapshot.
export function ResultsCard({
	snapshot,
	counts,
	liveStatus = "connecting",
}: {
	snapshot: PollSnapshot;
	counts: Record<number, number>;
	liveStatus?: LiveStatus;
}) {
	const now = useServerClock(snapshot.serverNow);
	const status = statusAt(snapshot.status, now);
	// Share opens the results: after the close anyone sees them, and before it a non-voter is sent to vote first.
	const shareUrl = useShareUrl(`/pr/${snapshot.id}/results`);

	return (
		<ResultsView
			poll={{ id: snapshot.id, question: snapshot.question, tone: snapshot.tone }}
			results={resultRows(snapshot.options, counts)}
			myVoteId={snapshot.myOptionId === null ? undefined : String(snapshot.myOptionId)}
			liveStatus={liveStatus}
			countdown={pollCountdown(status, now)}
			closedText={status.kind === "closed" ? CLOSED_TEXT[status.closedBy] : ""}
			viewers={snapshot.viewers}
			shareUrl={shareUrl}
			newPollLink={<a href="/" />}
		/>
	);
}
