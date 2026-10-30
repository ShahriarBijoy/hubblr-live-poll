import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleLiveTicket } from "../../slices/live-results/live-results.handler";

export const Route = createFileRoute("/api/polls/$pollId/live-ticket")({
	server: {
		handlers: {
			POST: ({ request, params }) => handleLiveTicket(request, params.pollId, { env }),
		},
	},
});
