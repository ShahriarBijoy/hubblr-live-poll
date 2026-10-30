import { CreatePollCommand, type PollSnapshot } from "@poll-request/domain";
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { AdminTokenHash } from "../../platform/admin-token";
import { handleCastVote, loadVoteView, type VoteViewDeps } from "./cast-vote.handler";

let sequence = 0;
function unique(): number {
	sequence += 1;
	return sequence;
}

// Each test gets its own client IP, so the vote limit of one test cannot leak into another.
function newIp(): string {
	return `198.51.100.${unique()}`;
}

async function openPoll(): Promise<string> {
	const id = `v${String(unique()).padStart(9, "0")}`;
	const command = CreatePollCommand.parse({
		id,
		question: "Tabs or spaces?",
		options: ["Tabs", "Spaces", "Both, chaos"],
		durationSec: 300,
		tone: "flame",
	});
	await env.POLL_ROOM.getByName(id).create(command, "hash" as AdminTokenHash);
	return id;
}

function pageRequest(pollId: string, cookie?: string): Request {
	return new Request(`https://poll.test/pr/${pollId}`, cookie === undefined ? {} : { headers: { Cookie: cookie } });
}

// The cookie a browser keeps after it opens the public link.
async function voterCookie(pollId: string, bindings: VoteViewDeps["env"] = env): Promise<string> {
	const { setCookie } = await loadVoteView(pageRequest(pollId), pollId, { env: bindings });
	if (setCookie === null) throw new Error("expected the page to set a voter cookie");
	return setCookie.split(";")[0] ?? "";
}

async function put(
	pollId: string,
	body: unknown,
	{ cookie, ip }: { cookie: string | null; ip: string },
): Promise<Response> {
	const headers: Record<string, string> = { "Content-Type": "application/json", "cf-connecting-ip": ip };
	if (cookie !== null) headers.Cookie = cookie;
	const request = new Request(`https://poll.test/api/polls/${pollId}/vote`, {
		method: "PUT",
		headers,
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
	return handleCastVote(request, pollId, { env });
}

async function totalVotesSeenBy(pollId: string, cookie: string): Promise<number> {
	const { result } = await loadVoteView(pageRequest(pollId, cookie), pollId, { env });
	if (result.kind !== "found") throw new Error("expected the poll to exist");
	return result.snapshot.totalVotes;
}

describe("PUT /api/polls/{pollId}/vote", () => {
	it("records a first vote and answers 200 with the new count", async () => {
		const pollId = await openPoll();
		const response = await put(pollId, { optionId: 2 }, { cookie: await voterCookie(pollId), ip: newIp() });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: pollId,
			question: "Tabs or spaces?",
			options: [
				{ id: 1, label: "Tabs" },
				{ id: 2, label: "Spaces" },
				{ id: 3, label: "Both, chaos" },
			],
			tone: "flame",
			status: { kind: "open", closesAt: expect.any(Number) },
			totalVotes: 1,
			results: { counts: { 1: 0, 2: 1, 3: 0 }, version: 1 },
			viewers: 0,
			serverNow: expect.any(Number),
			myOptionId: 2,
		});
	});

	it("answers the same vote again with the same counts and the same version", async () => {
		const pollId = await openPoll();
		const voter = { cookie: await voterCookie(pollId), ip: newIp() };
		const first = await (await put(pollId, { optionId: 2 }, voter)).json<PollSnapshot>();
		const again = await put(pollId, { optionId: 2 }, voter);

		expect(again.status).toBe(200);
		expect((await again.json<PollSnapshot>()).results).toEqual(first.results);
		expect(first.results).toEqual({ counts: { 1: 0, 2: 1, 3: 0 }, version: 1 });
	});

	it("answers 409 to another option from a voter who voted, and changes no count or version", async () => {
		const pollId = await openPoll();
		const voter = { cookie: await voterCookie(pollId), ip: newIp() };
		await put(pollId, { optionId: 1 }, voter);
		const changed = await put(pollId, { optionId: 3 }, voter);
		const again = await (await put(pollId, { optionId: 1 }, voter)).json<PollSnapshot>();

		expect(changed.status).toBe(409);
		expect(await changed.json()).toEqual({
			code: "already_voted",
			message: "You already voted in this poll.",
		});
		expect(again.results).toEqual({ counts: { 1: 1, 2: 0, 3: 0 }, version: 1 });
	});

	it("counts 100 parallel votes from 100 voters as 100, one write at a time", async () => {
		const pollId = await openPoll();
		const ip = newIp();
		const cookies = await Promise.all(Array.from({ length: 100 }, () => voterCookie(pollId)));

		const responses = await Promise.all(
			cookies.map((cookie, index) => put(pollId, { optionId: (index % 3) + 1 }, { cookie, ip })),
		);
		const snapshots = await Promise.all(responses.map((response) => response.json<PollSnapshot>()));

		expect(responses.map((response) => response.status)).toEqual(Array.from({ length: 100 }, () => 200));
		expect(snapshots.map((snapshot) => snapshot.totalVotes).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 100 }, (_, index) => index + 1),
		);
		expect(await totalVotesSeenBy(pollId, cookies[0] ?? "")).toBe(100);
	});

	it("answers 410 at closes_at when no alarm ran, and records nothing", async () => {
		const pollId = await openPoll();
		const cookie = await voterCookie(pollId);
		await runInDurableObject(env.POLL_ROOM.getByName(pollId), (_room, state) => {
			state.storage.sql.exec("UPDATE poll SET closes_at = ?", Date.now());
		});

		const response = await put(pollId, { optionId: 1 }, { cookie, ip: newIp() });

		expect(response.status).toBe(410);
		expect(await response.json()).toEqual({
			code: "poll_closed",
			message: "This poll is closed. Here are the final results.",
		});
		expect(await totalVotesSeenBy(pollId, cookie)).toBe(0);
	});

	it.each([
		["no cookie", async () => null],
		["a value without a signature", async (pollId: string) => (await voterCookie(pollId)).replace(/\.[^.]*$/, "")],
		[
			"a changed signature",
			async (pollId: string) => {
				const cookie = await voterCookie(pollId);
				const mac = cookie.lastIndexOf(".") + 1;
				return `${cookie.slice(0, mac)}${cookie[mac] === "A" ? "B" : "A"}${cookie.slice(mac + 1)}`;
			},
		],
		[
			"a cookie signed with another secret",
			async (pollId: string) => voterCookie(pollId, { ...env, VOTER_SECRET: "another-secret-".repeat(3) }),
		],
	])("answers 401 for %s, and records nothing", async (_case, cookieFor: (id: string) => Promise<string | null>) => {
		const pollId = await openPoll();
		const response = await put(pollId, { optionId: 1 }, { cookie: await cookieFor(pollId), ip: newIp() });

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ code: "voter_cookie_invalid", message: expect.any(String) });
		expect(await totalVotesSeenBy(pollId, await voterCookie(pollId))).toBe(0);
	});

	it("answers 400 unknown_option for an option that is not in the poll", async () => {
		const pollId = await openPoll();
		const response = await put(pollId, { optionId: 9 }, { cookie: await voterCookie(pollId), ip: newIp() });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ code: "unknown_option", message: expect.any(String) });
	});

	it.each([[{ optionId: "two" }], [{}], ["{not json"]])("answers 400 invalid_body for %j", async (body) => {
		const pollId = await openPoll();
		const response = await put(pollId, body, { cookie: await voterCookie(pollId), ip: newIp() });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ code: "invalid_body", message: expect.any(String) });
	});

	it.each([["a poll ID nobody opened", "nobody0001"], ["a malformed poll ID", "not a poll id"]])(
		"answers 404 for %s",
		async (_case, pollId) => {
			const cookie = await voterCookie(await openPoll());
			const response = await put(pollId, { optionId: 1 }, { cookie, ip: newIp() });

			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({
				code: "poll_not_found",
				message: "This poll does not exist. Create a new one?",
			});
		},
	);

	it("answers 413 to a body over 4 KB", async () => {
		const pollId = await openPoll();
		const body = JSON.stringify({ optionId: 1, padding: "x".repeat(4_100) });
		const response = await put(pollId, body, { cookie: await voterCookie(pollId), ip: newIp() });

		expect(response.status).toBe(413);
	});

	it("answers 429 to the 21st vote of one voter within 10 s, and still accepts another voter on that IP", async () => {
		const pollId = await openPoll();
		const voter = { cookie: await voterCookie(pollId), ip: newIp() };
		// The local limiter counts in 10 s windows aligned to the wall clock. A burst that crosses a window edge
		// starts a fresh count, so the burst waits for a window with at least 5 s left.
		const leftInWindow = 10_000 - (Date.now() % 10_000);
		if (leftInWindow < 5_000) await new Promise((resolve) => setTimeout(resolve, leftInWindow + 50));
		const statuses: number[] = [];
		for (let attempt = 0; attempt < 20; attempt += 1) {
			statuses.push((await put(pollId, { optionId: 1 }, voter)).status);
		}
		const twentyFirst = await put(pollId, { optionId: 1 }, voter);

		expect(statuses).toEqual(Array.from({ length: 20 }, () => 200));
		expect(twentyFirst.status).toBe(429);
		expect((await put(pollId, { optionId: 1 }, { ...voter, cookie: await voterCookie(pollId) })).status).toBe(200);
	}, 15_000);
});

describe("the vote view load", () => {
	it("sets the voter cookie on the first visit only, and that cookie can vote", async () => {
		const pollId = await openPoll();
		const first = await loadVoteView(pageRequest(pollId), pollId, { env });
		const cookie = first.setCookie?.split(";")[0] ?? "";
		const again = await loadVoteView(pageRequest(pollId, cookie), pollId, { env });

		expect(first.setCookie).toMatch(/^pr_voter=/);
		expect(again.setCookie).toBeNull();
		expect((await put(pollId, { optionId: 1 }, { cookie, ip: newIp() })).status).toBe(200);
	});

	it("gives a voter who voted the total and their choice, and no counts for each option", async () => {
		const pollId = await openPoll();
		const ip = newIp();
		const voters = await Promise.all([voterCookie(pollId), voterCookie(pollId), voterCookie(pollId)]);
		await put(pollId, { optionId: 1 }, { cookie: voters[0] ?? "", ip });
		await put(pollId, { optionId: 1 }, { cookie: voters[1] ?? "", ip });
		await put(pollId, { optionId: 2 }, { cookie: voters[2] ?? "", ip });

		const { result } = await loadVoteView(pageRequest(pollId, voters[2]), pollId, { env });

		expect(result).toMatchObject({ kind: "found", snapshot: { totalVotes: 3, myOptionId: 2, results: null } });
		expect(JSON.stringify(result)).not.toContain("counts");
	});

	it("answers not-found without a cookie for a malformed poll ID, and not-found for an unknown one", async () => {
		expect(await loadVoteView(pageRequest("bad id"), "bad id", { env })).toEqual({
			result: { kind: "not-found" },
			setCookie: null,
		});
		expect((await loadVoteView(pageRequest("unknown001"), "unknown001", { env })).result).toEqual({
			kind: "not-found",
		});
	});
});
