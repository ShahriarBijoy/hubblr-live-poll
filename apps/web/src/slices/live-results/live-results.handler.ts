import { PollId } from "@poll-request/domain";
import { adminTokenHashOf } from "../../platform/admin-token";
import { errorResponse } from "../../platform/http";
import { voterIdOf } from "../../platform/voter-cookie";
import { issueLiveTicket, verifyLiveTicket } from "./live-ticket";

// Other slices repeat these messages, because slices cannot import each other.
const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";
const POLL_CLOSED_MESSAGE = "This poll is closed. Here are the final results.";
const VOTE_FIRST_MESSAGE = "Vote first to see live results.";

export type LiveDeps = { env: Pick<Env, "POLL_ROOM" | "VOTER_SECRET"> };

export async function handleLiveTicket(request: Request, pollIdParam: string, { env }: LiveDeps): Promise<Response> {
	const pollId = PollId.safeParse(pollIdParam);
	if (!pollId.success) return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);

	const voterId = await voterIdOf(request, env.VOTER_SECRET);
	const adminTokenHash = await adminTokenHashOf(request);
	if (voterId === null && adminTokenHash === null) return errorResponse(403, "not_a_voter", VOTE_FIRST_MESSAGE);

	const access = await env.POLL_ROOM.getByName(pollId.data).liveAccess(voterId, adminTokenHash);
	switch (access.kind) {
		case "ok": {
			const ticket = await issueLiveTicket(env.VOTER_SECRET, pollId.data, access.role, Date.now());
			return Response.json({ ticket }, { headers: { "Cache-Control": "no-store" } });
		}
		case "not-voted":
			return errorResponse(403, "not_a_voter", VOTE_FIRST_MESSAGE);
		case "closed":
			return errorResponse(410, "poll_closed", POLL_CLOSED_MESSAGE);
		case "not-found":
			return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);
	}
}

// A browser sends cookies on a cross-site upgrade, so the upgrade trusts the ticket from a same-origin POST and the
// Origin header instead.
export async function routeLiveSocket(request: Request, pollIdParam: string, { env }: LiveDeps): Promise<Response> {
	if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
		return new Response("Upgrade Required", { status: 426, headers: { Upgrade: "websocket" } });
	}
	const url = new URL(request.url);
	if (request.headers.get("Origin") !== url.origin) return new Response("Forbidden", { status: 403 });
	// Only a valid poll ID gets a ticket, so a verified ticket also vouches for pollIdParam.
	const ticket = url.searchParams.get("ticket");
	if (ticket === null || !(await verifyLiveTicket(env.VOTER_SECRET, ticket, pollIdParam, Date.now()))) {
		return new Response("Forbidden", { status: 403 });
	}
	return env.POLL_ROOM.getByName(pollIdParam).fetch(request);
}
