import { CreatePollRequest } from "@poll-request/domain";
import { hashAdminToken } from "../../platform/admin-token";
import { errorResponse, readJsonBody } from "../../platform/http";
import { insertOpenSummary } from "../../platform/kpi-store";
import { clientIp, isRateLimited, rateLimitedResponse } from "../../platform/rate-limit";
import { FIELD_PROBLEMS, fieldOfPath, invalidFieldCode } from "./create-poll.schema";

export type CreatePollDeps = {
	env: Pick<Env, "POLL_ROOM" | "KPI_DB" | "CREATE_LIMITER">;
	waitUntil: (promise: Promise<unknown>) => void;
};

export async function handleCreatePoll(request: Request, { env, waitUntil }: CreatePollDeps): Promise<Response> {
	if (await isRateLimited(env.CREATE_LIMITER, clientIp(request))) return rateLimitedResponse();

	const body = await readJsonBody(request);
	if (body.kind === "too-large") {
		return errorResponse(413, "payload_too_large", "The request body is over 4 KB. Shorten the text.");
	}

	const parsed = CreatePollRequest.safeParse(body.value);
	if (!parsed.success) {
		const field = fieldOfPath(parsed.error.issues[0]?.path ?? []);
		return field === null
			? errorResponse(400, "invalid_body", "Send a JSON object with id, question, options, durationSec, tone, and adminToken.")
			: errorResponse(400, invalidFieldCode(field), FIELD_PROBLEMS[field]);
	}

	const { adminToken, ...command } = parsed.data;
	const result = await env.POLL_ROOM.getByName(command.id).create(command, await hashAdminToken(adminToken));
	if (result.kind === "conflict") {
		return errorResponse(409, "poll_id_taken", "A different poll already uses this ID. Send a new ID and token.");
	}

	waitUntil(
		insertOpenSummary(env.KPI_DB, result.summary).catch((error: unknown) => {
			console.error("poll_summary: the open row was not written", { pollId: command.id, error });
		}),
	);
	return Response.json(result.snapshot, { status: result.kind === "created" ? 201 : 200 });
}
