import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { handleCreatePoll } from "../../slices/create-poll/create-poll.handler";

export const Route = createFileRoute("/api/polls")({
	server: {
		handlers: {
			POST: ({ request }) => handleCreatePoll(request, { env, waitUntil }),
		},
	},
});
