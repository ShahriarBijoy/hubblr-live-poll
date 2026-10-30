import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleGetPoll } from "../../slices/view-results/view-results.handler";

export const Route = createFileRoute("/api/polls/$pollId")({
	server: {
		handlers: {
			GET: ({ request, params }) => handleGetPoll(request, params.pollId, { env }),
		},
	},
});
