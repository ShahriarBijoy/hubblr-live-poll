import { PollId } from "@poll-request/domain";
import { adminTokenOf, hashAdminToken } from "../../platform/admin-token";
import { errorResponse } from "../../platform/http";
import { clientIp, isRateLimited, rateLimitedResponse } from "../../platform/rate-limit";

// Section 16 text. Other slices have the same constant, and slices cannot import each other.
const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";

export type ClosePollDeps = { env: Pick<Env, "POLL_ROOM" | "ADMIN_LIMITER"> };

// Nothing here logs the request: its Authorization header carries the admin token.
export async function handleClosePoll(request: Request, pollIdParam: string, { env }: ClosePollDeps): Promise<Response> {
	const pollId = PollId.safeParse(pollIdParam);
	if (!pollId.success) return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);

	const token = adminTokenOf(request);
	if (token === null) {
		return errorResponse(401, "admin_token_missing", "Send the admin token from your manage link to close the poll.");
	}

	if (await isRateLimited(env.ADMIN_LIMITER, clientIp(request))) return rateLimitedResponse();

	const result = await env.POLL_ROOM.getByName(pollId.data).close(await hashAdminToken(token));
	switch (result.kind) {
		case "closed":
			return Response.json(result.snapshot, { headers: { "Cache-Control": "no-store" } });
		case "forbidden":
			return errorResponse(403, "admin_token_invalid", "This manage link does not belong to this poll. Open your own.");
		case "not-found":
			return errorResponse(404, "poll_not_found", POLL_NOT_FOUND_MESSAGE);
	}
}
