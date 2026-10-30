import { createFileRoute } from "@tanstack/react-router";
import { PollNotFound, ResultsView, loadResultsPage } from "../slices/view-results/view-results.view";

export const Route = createFileRoute("/pr/$pollId/results")({
	loader: ({ context, params }) => loadResultsPage(context.queryClient, params.pollId),
	// The question only, so a link preview never leaks the counts.
	head: ({ loaderData }) => ({
		meta: loaderData ? [{ title: loaderData.question }, { property: "og:title", content: loaderData.question }] : [],
	}),
	component: ResultsRoute,
	notFoundComponent: PollNotFound,
});

function ResultsRoute() {
	const { pollId } = Route.useParams();
	return <ResultsView key={pollId} pollId={pollId} />;
}
