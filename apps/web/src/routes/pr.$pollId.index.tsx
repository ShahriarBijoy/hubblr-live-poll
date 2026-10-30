import { createFileRoute } from "@tanstack/react-router";
import { PollNotFound, VoteView, loadVotePage } from "../slices/cast-vote/cast-vote.view";

export const Route = createFileRoute("/pr/$pollId/")({
	loader: ({ context, params }) => loadVotePage(context.queryClient, params.pollId),
	// The public link is the one people paste into chat, so its preview shows the question.
	head: ({ loaderData }) => ({
		meta: loaderData ? [{ title: loaderData.question }, { property: "og:title", content: loaderData.question }] : [],
	}),
	component: VoteRoute,
	notFoundComponent: PollNotFound,
});

function VoteRoute() {
	const { pollId } = Route.useParams();
	// The key resets the pick and the vote state when the voter moves to another poll.
	return <VoteView key={pollId} pollId={pollId} />;
}
