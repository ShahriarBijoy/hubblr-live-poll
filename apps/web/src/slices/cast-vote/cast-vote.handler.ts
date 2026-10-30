import { CastVoteRequest, PollId } from "@poll-request/domain";
import { errorResponse, readJsonBody } from "../../platform/http";
import { clientIp, isRateLimited, rateLimitedResponse } from "../../platform/rate-limit";
import { ensureVoter, voterIdOf } from "../../platform/voter-cookie";
import { ALREADY_VOTED_MESSAGE, POLL_CLOSED_MESSAGE, POLL_NOT_FOUND_MESSAGE, type VoteViewResult } from "./cast-vote.schema";

export type CastVoteDeps = { env: Pick<Env, "POLL_ROOM" | "VOTE_LIMITER" | "VOTER_SECRET"> };

// The checks run cheapest first, and none of them reaches PollRoom until the request is fully parsed.
export async function handleCastVote(request: Request, pollIdParam: string, { env }: CastVoteDeps): Promise<Response> {
	// A malformed ID names no poll, so it gets the same 404 as an unknown one.
	const pollId = PollId.safeParse(pollIdParam);
	if (!pollId.success) return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);

	// The PUT never mints a voter: the page does. Minting here would turn every request without a cookie into a vote.
	const voterId = await voterIdOf(request, env.VOTER_SECRET);
	if (voterId === null) {
		return errorResponse(401, "voter_cookie_invalid", "Your voter cookie is missing or expired. Open the poll again.");
	}

	// Voter and IP together, so many voters behind one IP (a classroom, a load test) each get their own bucket.
	if (await isRateLimited(env.VOTE_LIMITER, `${voterId}|${clientIp(request)}`)) return rateLimitedResponse();

	const body = await readJsonBody(request);
	if (body.kind === "too-large") return errorResponse(413, "payload_too_large", "The request body is over 4 KB.");
	const parsed = CastVoteRequest.safeParse(body.value);
	if (!parsed.success) return errorResponse(400, "invalid_body", "Send a JSON object with a numeric optionId.");

	const result = await env.POLL_ROOM.getByName(pollId.data).vote(voterId, parsed.data.optionId);
	switch (result.kind) {
		case "recorded":
		case "unchanged":
			return Response.json(result.snapshot);
		case "unknown-option":
			return errorResponse(400, "unknown_option", "That option is not in this poll. Reload the page and pick again.");
		case "already-voted":
			return errorResponse(409, "already_voted", ALREADY_VOTED_MESSAGE);
		case "closed":
			return errorResponse(410, "poll_closed", POLL_CLOSED_MESSAGE);
		case "not-found":
			return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);
	}
}

export type VoteViewDeps = { env: Pick<Env, "POLL_ROOM" | "VOTER_SECRET"> };

export type VoteViewLoad = { result: VoteViewResult; setCookie: string | null };

// The vote view's read, for the server render and for a client navigation alike. The page is where a voter gets the
// cookie, so the caller must send setCookie with its response.
export async function loadVoteView(
	request: Request,
	pollIdParam: string,
	{ env }: VoteViewDeps,
): Promise<VoteViewLoad> {
	const pollId = PollId.safeParse(pollIdParam);
	if (!pollId.success) return { result: { kind: "not-found" }, setCookie: null };
	const { voterId, setCookie } = await ensureVoter(request, env.VOTER_SECRET);
	return { result: await env.POLL_ROOM.getByName(pollId.data).voteView(voterId), setCookie };
}
