import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PollNotFound } from "../../platform/poll-page";
import { VoteCard } from "./cast-vote.card";
import { voteViewQuery } from "./cast-vote.query";

export { PollNotFound } from "../../platform/poll-page";
export { loadVotePage } from "./cast-vote.query";

export function VoteView({ pollId }: { pollId: string }) {
	const { data } = useSuspenseQuery(voteViewQuery(pollId));
	const navigate = useNavigate();
	// The route answers an unknown poll on the first load. This branch is for a poll that is gone after a vote failed.
	if (data.kind === "not-found") return <PollNotFound />;
	return (
		<VoteCard
			pollId={pollId}
			snapshot={data.snapshot}
			onVoted={() => void navigate({ to: "/pr/$pollId/results", params: { pollId } })}
		/>
	);
}
