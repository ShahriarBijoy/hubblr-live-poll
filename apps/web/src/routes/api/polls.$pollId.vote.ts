import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleCastVote } from "../../slices/cast-vote/cast-vote.handler";

export const Route = createFileRoute("/api/polls/$pollId/vote")({
	server: {
		handlers: {
			PUT: ({ request, params }) => handleCastVote(request, params.pollId, { env }),
		},
	},
});
