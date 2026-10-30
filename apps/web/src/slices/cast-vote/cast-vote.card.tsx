import { statusAt } from "@poll-request/domain";
import { VoteView } from "@poll-request/ui/poll/views/vote-view";
import { CLOSED_TEXT, pollCountdown, useServerClock, useShareUrl } from "../../platform/poll-page";
import { voteCountText, useCastVote } from "./cast-vote.form";
import type { VoteViewSnapshot } from "./cast-vote.schema";

// Apart from the query module, whose server function needs the TanStack Start build, so a test can render the card
// with a seeded snapshot. The caller owns the navigation after a vote, and the links are plain anchors, so the card
// needs no router.
export function VoteCard({
	pollId,
	snapshot,
	onVoted,
}: {
	pollId: string;
	snapshot: VoteViewSnapshot;
	onVoted: () => void;
}) {
	const now = useServerClock(snapshot.serverNow);
	const status = statusAt(snapshot.status, now);
	const castVote = useCastVote(pollId);
	const shareUrl = useShareUrl(`/pr/${pollId}`);

	function vote(optionId: string) {
		if (castVote.isPending) return;
		// From the mutation's answer, not the optimistic write, so the results loader sees the stored vote.
		castVote.mutate(Number(optionId), {
			onSuccess: onVoted,
			// A voter who already voted belongs on the results page too.
			onError: (error) => {
				if (error.status === 409) onVoted();
			},
		});
	}

	return (
		<VoteView
			poll={{
				id: snapshot.id,
				question: snapshot.question,
				options: snapshot.options.map((option) => ({ id: String(option.id), label: option.label })),
				tone: snapshot.tone,
			}}
			totalVotes={snapshot.totalVotes}
			countdown={pollCountdown(status, now)}
			closedText={status.kind === "closed" ? CLOSED_TEXT[status.closedBy] : ""}
			countText={voteCountText(snapshot.totalVotes, snapshot.myOptionId !== null)}
			myVoteId={snapshot.myOptionId === null ? undefined : String(snapshot.myOptionId)}
			shareUrl={shareUrl}
			onVote={vote}
			voting={castVote.isPending}
			error={castVote.isError ? castVote.error.message : null}
			resultsLink={<a href={`/pr/${pollId}/results`} />}
			newPollLink={<a href="/" />}
		/>
	);
}
