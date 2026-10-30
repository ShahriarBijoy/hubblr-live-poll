import { PollId } from "@poll-request/domain";
import { adminTokenHashOf } from "../../platform/admin-token";
import { errorResponse } from "../../platform/http";
import { voterIdOf } from "../../platform/voter-cookie";
import { POLL_NOT_FOUND_MESSAGE, type ResultsResult } from "./view-results.schema";

export type ResultsDeps = { env: Pick<Env, "POLL_ROOM" | "VOTER_SECRET"> };

// The read for the API and the results view alike. It never mints a voter: a user without a cookie has not voted, and
// the vote view is where the cookie comes from. An admin token in the Authorization header makes the viewer the creator.
export async function readResults(request: Request, pollIdParam: string, { env }: ResultsDeps): Promise<ResultsResult> {
	const pollId = PollId.safeParse(pollIdParam);
	if (!pollId.success) return { kind: "not-found" };
	const voterId = await voterIdOf(request, env.VOTER_SECRET);
	return env.POLL_ROOM.getByName(pollId.data).results(voterId, await adminTokenHashOf(request));
}

export async function handleGetPoll(request: Request, pollIdParam: string, deps: ResultsDeps): Promise<Response> {
	const result = await readResults(request, pollIdParam, deps);
	if (result.kind === "not-found") return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);
	// The answer holds this voter's choice, so no shared cache may keep it.
	return Response.json(result.snapshot, { headers: { "Cache-Control": "no-store" } });
}
