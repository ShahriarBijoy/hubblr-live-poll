import { AdminToken, CreatePollCommand, OptionId, PollId, type VoterId } from "@poll-request/domain";
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashAdminToken } from "../../platform/admin-token";
import { ensureVoter } from "../../platform/voter-cookie";
import { handleLiveTicket, routeLiveSocket } from "./live-results.handler";
import { issueLiveTicket } from "./live-ticket";

const ORIGIN = "https://poll.test";

const ADMIN_TOKEN = AdminToken.parse("A".repeat(43));

let sequence = 0;
async function openPoll(): Promise<string> {
	sequence += 1;
	const id = `l${String(sequence).padStart(9, "0")}`;
	const command = CreatePollCommand.parse({
		id,
		question: "Tabs or spaces?",
		options: ["Tabs", "Spaces"],
		durationSec: 300,
		tone: "flame",
	});
	await env.POLL_ROOM.getByName(id).create(command, await hashAdminToken(ADMIN_TOKEN));
	return id;
}

async function newVoter(): Promise<{ voterId: VoterId; cookie: string }> {
	const { voterId, setCookie } = await ensureVoter(new Request(`${ORIGIN}/`), env.VOTER_SECRET);
	return { voterId, cookie: setCookie?.split(";")[0] ?? "" };
}

async function voterWhoVoted(pollId: string): Promise<string> {
	const { voterId, cookie } = await newVoter();
	await env.POLL_ROOM.getByName(pollId).vote(voterId, OptionId.parse(1));
	return cookie;
}

function postTicket(pollId: string, cookie?: string, authorization?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (cookie !== undefined) headers.Cookie = cookie;
	if (authorization !== undefined) headers.Authorization = authorization;
	const request = new Request(`${ORIGIN}/api/polls/${pollId}/live-ticket`, { method: "POST", headers });
	return handleLiveTicket(request, pollId, { env });
}

function upgrade(pollId: string, { ticket, origin = ORIGIN, websocket = true }: UpgradeOptions): Promise<Response> {
	const url = `${ORIGIN}/api/polls/${pollId}/live${ticket === undefined ? "" : `?ticket=${encodeURIComponent(ticket)}`}`;
	const headers: Record<string, string> = {};
	if (websocket) headers.Upgrade = "websocket";
	if (origin !== null) headers.Origin = origin;
	return routeLiveSocket(new Request(url, { headers }), pollId, { env });
}

type UpgradeOptions = { ticket?: string; origin?: string | null; websocket?: boolean };

describe("POST /api/polls/{pollId}/live-ticket", () => {
	it("gives a voter who voted a ticket that opens the socket", async () => {
		const pollId = await openPoll();
		const response = await postTicket(pollId, await voterWhoVoted(pollId));

		expect(response.status).toBe(200);
		const { ticket } = await response.json<{ ticket: string }>();
		const socket = await upgrade(pollId, { ticket });
		expect(socket.status).toBe(101);
		socket.webSocket?.accept();
		socket.webSocket?.close(1000);
	});

	it("gives the creator a ticket that opens the socket, and a wrong token a 403", async () => {
		const pollId = await openPoll();
		const response = await postTicket(pollId, undefined, `Bearer ${ADMIN_TOKEN}`);

		expect(response.status).toBe(200);
		const { ticket } = await response.json<{ ticket: string }>();
		const socket = await upgrade(pollId, { ticket });
		expect(socket.status).toBe(101);
		socket.webSocket?.accept();
		socket.webSocket?.close(1000);
		expect((await postTicket(pollId, undefined, `Bearer ${"B".repeat(43)}`)).status).toBe(403);
	});

	it("answers 403 to a voter who has not voted and to a request without a cookie", async () => {
		const pollId = await openPoll();

		for (const response of [await postTicket(pollId, (await newVoter()).cookie), await postTicket(pollId)]) {
			expect(response.status).toBe(403);
			expect(await response.json()).toEqual({ code: "not_a_voter", message: expect.any(String) });
		}
	});

	it.each([["a poll ID nobody opened", "nobody0001"], ["a malformed poll ID", "not a poll id"]])(
		"answers 404 for %s",
		async (_case, pollId) => {
			const response = await postTicket(pollId, (await newVoter()).cookie);

			expect(response.status).toBe(404);
		},
	);

	it("answers 410 after the close", async () => {
		const pollId = await openPoll();
		const cookie = await voterWhoVoted(pollId);
		await runInDurableObject(env.POLL_ROOM.getByName(pollId), (_room, state) => {
			state.storage.sql.exec("UPDATE poll SET closes_at = ?", Date.now() - 1);
		});

		expect((await postTicket(pollId, cookie)).status).toBe(410);
	});
});

describe("GET /api/polls/{pollId}/live", () => {
	it("answers 426 to a request that is not an upgrade", async () => {
		const pollId = await openPoll();
		const ticket = await issueLiveTicket(env.VOTER_SECRET, PollId.parse(pollId), "voter", Date.now());

		expect((await upgrade(pollId, { ticket, websocket: false })).status).toBe(426);
	});

	it("answers 403 to a missing or foreign Origin", async () => {
		const pollId = await openPoll();
		const ticket = await issueLiveTicket(env.VOTER_SECRET, PollId.parse(pollId), "voter", Date.now());

		expect((await upgrade(pollId, { ticket, origin: null })).status).toBe(403);
		expect((await upgrade(pollId, { ticket, origin: "https://evil.test" })).status).toBe(403);
	});

	it("answers 403 to no ticket, an expired ticket, and a ticket for another poll", async () => {
		const pollId = await openPoll();
		const expired = await issueLiveTicket(env.VOTER_SECRET, PollId.parse(pollId), "voter", Date.now() - 60_000);
		const other = await issueLiveTicket(env.VOTER_SECRET, PollId.parse(await openPoll()), "voter", Date.now());

		expect((await upgrade(pollId, {})).status).toBe(403);
		expect((await upgrade(pollId, { ticket: expired })).status).toBe(403);
		expect((await upgrade(pollId, { ticket: other })).status).toBe(403);
	});
});
