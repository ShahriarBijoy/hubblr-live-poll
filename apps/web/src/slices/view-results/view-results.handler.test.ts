import { AdminToken, CreatePollCommand, OptionId, type PollSnapshot, type VoterId } from "@poll-request/domain";
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashAdminToken } from "../../platform/admin-token";
import { ensureVoter } from "../../platform/voter-cookie";
import { handleGetPoll } from "./view-results.handler";

const ADMIN_TOKEN = AdminToken.parse("A".repeat(43));

let sequence = 0;
async function openPoll(): Promise<string> {
	sequence += 1;
	const id = `r${String(sequence).padStart(9, "0")}`;
	const command = CreatePollCommand.parse({
		id,
		question: "Tabs or spaces?",
		options: ["Tabs", "Spaces", "Both, chaos"],
		durationSec: 300,
		tone: "flame",
	});
	await env.POLL_ROOM.getByName(id).create(command, await hashAdminToken(ADMIN_TOKEN));
	return id;
}

// A new voter, as the vote view mints one for a request without a cookie, and the cookie the browser keeps.
async function newVoter(): Promise<{ voterId: VoterId; cookie: string }> {
	const { voterId, setCookie } = await ensureVoter(new Request("https://poll.test/"), env.VOTER_SECRET);
	return { voterId, cookie: setCookie?.split(";")[0] ?? "" };
}

async function voterWhoVoted(pollId: string, optionId: number): Promise<string> {
	const { voterId, cookie } = await newVoter();
	await env.POLL_ROOM.getByName(pollId).vote(voterId, OptionId.parse(optionId));
	return cookie;
}

function get(pollId: string, cookie?: string, authorization?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (cookie !== undefined) headers.Cookie = cookie;
	if (authorization !== undefined) headers.Authorization = authorization;
	return handleGetPoll(new Request(`https://poll.test/api/polls/${pollId}`, { headers }), pollId, { env });
}

describe("GET /api/polls/{pollId}", () => {
	it("gives a voter who voted the counts", async () => {
		const pollId = await openPoll();
		await voterWhoVoted(pollId, 1);
		const cookie = await voterWhoVoted(pollId, 2);

		const response = await get(pollId, cookie);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			totalVotes: 2,
			myOptionId: 2,
			results: { counts: { 1: 1, 2: 1, 3: 0 }, version: 2 },
		});
	});

	it("gives the creator the counts of an open poll, and a wrong token none", async () => {
		const pollId = await openPoll();
		await voterWhoVoted(pollId, 2);

		const creator = await (await get(pollId, undefined, `Bearer ${ADMIN_TOKEN}`)).json<PollSnapshot>();
		const stranger = await (await get(pollId, undefined, `Bearer ${"B".repeat(43)}`)).json<PollSnapshot>();

		expect(creator).toMatchObject({ status: { kind: "open" }, myOptionId: null, results: { counts: { 2: 1 } } });
		expect(stranger.results).toBeNull();
	});

	it("gives no counts while the poll is open to a user without a cookie or with one that has not voted", async () => {
		const pollId = await openPoll();
		await voterWhoVoted(pollId, 1);
		const { cookie } = await newVoter();

		for (const response of [await get(pollId), await get(pollId, cookie)]) {
			const body = await response.json<PollSnapshot>();
			expect(response.status).toBe(200);
			expect(body).toMatchObject({ totalVotes: 1, myOptionId: null, results: null });
			expect(JSON.stringify(body)).not.toContain("counts");
		}
	});

	it("gives everyone the final counts after the close", async () => {
		const pollId = await openPoll();
		await voterWhoVoted(pollId, 3);
		await runInDurableObject(env.POLL_ROOM.getByName(pollId), (_room, state) => {
			state.storage.sql.exec("UPDATE poll SET closes_at = ?", Date.now() - 1);
		});

		const body = await (await get(pollId)).json<PollSnapshot>();

		expect(body.status).toMatchObject({ kind: "closed", closedBy: "timer" });
		expect(body.results).toEqual({ counts: { 1: 0, 2: 0, 3: 1 }, version: 1 });
	});

	it.each([["a poll ID nobody opened", "nobody0001"], ["a malformed poll ID", "not a poll id"]])(
		"answers 404 for %s",
		async (_case, pollId) => {
			const response = await get(pollId);

			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({
				code: "poll_not_found",
				message: "This poll does not exist. Create a new one?",
			});
		},
	);
});
