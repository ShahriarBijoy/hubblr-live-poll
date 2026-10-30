import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleClosePoll } from "../../slices/close-poll/close-poll.handler";

export const Route = createFileRoute("/api/polls/$pollId/close")({
	server: {
		handlers: {
			POST: ({ request, params }) => handleClosePoll(request, params.pollId, { env }),
		},
	},
});
