import { AdminToken, CreatePollCommand, type PollSnapshot } from "@poll-request/domain";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashAdminToken } from "../../platform/admin-token";
import { toBase64Url } from "../../platform/base64url";
import { handleClosePoll } from "./close-poll.handler";

let sequence = 0;
function unique(): number {
	sequence += 1;
	return sequence;
}

function newToken(): AdminToken {
	return AdminToken.parse(toBase64Url(crypto.getRandomValues(new Uint8Array(32))));
}

async function openPoll(token: AdminToken): Promise<string> {
	const id = `c${String(unique()).padStart(9, "0")}`;
	const command = CreatePollCommand.parse({ id, question: "Tabs?", options: ["Yes", "No"], durationSec: 300, tone: "flame" });
	await env.POLL_ROOM.getByName(id).create(command, await hashAdminToken(token));
	return id;
}

// Each request gets its own client IP, so the admin limit of one test cannot leak into another.
function close(pollId: string, authorization?: string): Promise<Response> {
	const headers: Record<string, string> = { "cf-connecting-ip": `203.0.113.${unique()}` };
	if (authorization !== undefined) headers.Authorization = authorization;
	const request = new Request(`https://poll.test/api/polls/${pollId}/close`, { method: "POST", headers });
	return handleClosePoll(request, pollId, { env });
}

describe("POST /api/polls/{pollId}/close", () => {
	it.each([
		["no Authorization header", undefined],
		["a header that is not Bearer", `Basic ${"a".repeat(43)}`],
		["a token of the wrong format", "Bearer short"],
	])("answers 401 to %s", async (_case, authorization) => {
		const pollId = await openPoll(newToken());

		const response = await close(pollId, authorization);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: "admin_token_missing" });
	});

	it("answers 403 to another poll's token", async () => {
		const pollId = await openPoll(newToken());

		const response = await close(pollId, `Bearer ${newToken()}`);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: "admin_token_invalid" });
	});

	it("closes the poll for the creator, and answers a second close with the same closedAt", async () => {
		const token = newToken();
		const pollId = await openPoll(token);

		const first = await close(pollId, `Bearer ${token}`);
		const second = await close(pollId, `Bearer ${token}`);

		expect(first.status).toBe(200);
		const body = await first.json<PollSnapshot>();
		expect(body).toMatchObject({ status: { kind: "closed", closedBy: "creator" }, results: { version: 1 } });
		expect(second.status).toBe(200);
		expect((await second.json<PollSnapshot>()).status).toEqual(body.status);
	});

	it.each([["a poll ID nobody opened", "nobody0001"], ["a malformed poll ID", "not a poll id"]])(
		"answers 404 for %s",
		async (_case, pollId) => {
			expect((await close(pollId, `Bearer ${newToken()}`)).status).toBe(404);
		},
	);
});
