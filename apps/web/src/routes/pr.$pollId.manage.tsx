import { createFileRoute } from "@tanstack/react-router";
import { ManageView } from "../slices/close-poll/close-poll.view";

export const Route = createFileRoute("/pr/$pollId/manage")({ component: ManageRoute });

function ManageRoute() {
	const { pollId } = Route.useParams();
	return <ManageView pollId={pollId} />;
}
