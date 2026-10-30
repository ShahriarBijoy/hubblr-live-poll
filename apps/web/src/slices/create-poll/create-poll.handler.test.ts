import { createExecutionContext, runInDurableObject, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { handleCreatePoll, type CreatePollDeps } from "./create-poll.handler";

const TOKEN_A = "a".repeat(43);
const TOKEN_B = "b".repeat(43);
// SHA-256 of TOKEN_A in base64url, computed outside this code with Node's crypto module.
const TOKEN_A_HASH = "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA";

let sequence = 0;
function unique(): number {
	sequence += 1;
	return sequence;
}

function newPollId(): string {
	return `t${String(unique()).padStart(9, "0")}`;
}

// Each test gets its own client IP, so the create limit of one test cannot leak into another.
function newIp(): string {
	return `203.0.113.${unique()}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
	return {
		id: newPollId(),
		question: "Tabs or spaces?",
		options: ["Tabs", "Spaces", "Both, chaos"],
		durationSec: 300,
		tone: "flame",
		adminToken: TOKEN_A,
		...overrides,
	};
}

async function post(
	body: unknown,
	{ ip, bindings = env }: { ip: string; bindings?: CreatePollDeps["env"] },
): Promise<Response> {
	const ctx = createExecutionContext();
	const request = new Request("https://poll.test/api/polls", {
		method: "POST",
		headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
		body: typeof body === "string" || body instanceof ReadableStream ? body : JSON.stringify(body),
	});
	const response = await handleCreatePoll(request, { env: bindings, waitUntil: (promise) => ctx.waitUntil(promise) });
	await waitOnExecutionContext(ctx);
	return response;
}

type StoredPollRow = { admin_token_hash: string; created_at: number; closes_at: number };

function readPollRow(pollId: string): Promise<StoredPollRow> {
	return runInDurableObject(env.POLL_ROOM.getByName(pollId), (_room, state) =>
		state.storage.sql.exec<StoredPollRow>("SELECT admin_token_hash, created_at, closes_at FROM poll").one(),
	);
}

describe("POST /api/polls", () => {
	it("opens a poll and answers 201 with the creator's snapshot, without the token or its hash", async () => {
		const body = validBody();
		const response = await post(body, { ip: newIp() });
		const text = await response.text();

		expect(response.status).toBe(201);
		expect(JSON.parse(text)).toEqual({
			id: body.id,
			question: "Tabs or spaces?",
			options: [
				{ id: 1, label: "Tabs" },
				{ id: 2, label: "Spaces" },
				{ id: 3, label: "Both, chaos" },
			],
			tone: "flame",
			status: { kind: "open", closesAt: expect.any(Number) },
			totalVotes: 0,
			results: { counts: { 1: 0, 2: 0, 3: 0 }, version: 0 },
			viewers: 0,
			serverNow: expect.any(Number),
			myOptionId: null,
		});
		expect(text).not.toContain(TOKEN_A);
		expect(text).not.toContain(TOKEN_A_HASH);
		expect((await readPollRow(body.id)).admin_token_hash).toBe(TOKEN_A_HASH);
	});

	it("sets closes_at to the creation time plus durationSec", async () => {
		const body = validBody({ durationSec: 86400 });
		const snapshot = await (await post(body, { ip: newIp() })).json<{ status: { closesAt: number } }>();
		const row = await readPollRow(body.id);

		expect(row.closes_at - row.created_at).toBe(86_400_000);
		expect(snapshot.status.closesAt).toBe(row.closes_at);
	});

	it("answers 200 with the same poll when the same request comes again", async () => {
		const ip = newIp();
		const body = validBody();
		const first = await post(body, { ip });
		const again = await post(body, { ip });

		expect(first.status).toBe(201);
		expect(again.status).toBe(200);
		const [firstSnapshot, againSnapshot] = await Promise.all([first.json(), again.json()]);
		expect(againSnapshot).toEqual({ ...(firstSnapshot as object), serverNow: expect.any(Number) });
	});

	it("answers 409 when the same ID comes with a different body", async () => {
		const ip = newIp();
		const body = validBody();
		await post(body, { ip });
		const response = await post({ ...body, question: "Spaces or tabs?" }, { ip });

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ code: "poll_id_taken", message: expect.any(String) });
	});

	it("answers 409 when the same ID comes with a different token", async () => {
		const ip = newIp();
		const body = validBody();
		await post(body, { ip });
		const response = await post({ ...body, adminToken: TOKEN_B }, { ip });

		expect(response.status).toBe(409);
	});

	it.each([[["Only one"]], [["One", "Two", "Three", "Four", "Five", "Six"]]])(
		"answers 400 on the options field for %j",
		async (options) => {
			const response = await post(validBody({ options }), { ip: newIp() });

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ code: "invalid_options", message: expect.any(String) });
		},
	);

	it("answers 400 on the durationSec field for a value that is not whole minutes from 1 minute to 24 hours", async () => {
		const response = await post(validBody({ durationSec: 90 }), { ip: newIp() });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ code: "invalid_durationSec", message: expect.any(String) });
	});

	it("answers 400 on the tone field for a tone outside the palette", async () => {
		const response = await post(validBody({ tone: "neon" }), { ip: newIp() });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ code: "invalid_tone", message: expect.any(String) });
	});

	it("rejects a body over 4 KB, also when it streams in without a Content-Length", async () => {
		const oversized = JSON.stringify(validBody({ question: "x".repeat(4_100) }));
		const streamed = new Blob([oversized]).stream();

		expect((await post(oversized, { ip: newIp() })).status).toBe(413);
		expect((await post(streamed, { ip: newIp() })).status).toBe(413);
	});

	it("answers 429 to the sixth create from one IP within 60 seconds", async () => {
		const ip = newIp();
		const statuses: number[] = [];
		for (let attempt = 0; attempt < 5; attempt += 1) statuses.push((await post(validBody(), { ip })).status);
		const sixth = await post(validBody(), { ip });

		expect(statuses).toEqual([201, 201, 201, 201, 201]);
		expect(sixth.status).toBe(429);
		expect(await sixth.json()).toEqual({
			code: "rate_limited",
			message: "Too many requests. Try again in a few seconds.",
		});
		expect((await post(validBody(), { ip: newIp() })).status).toBe(201);
	});

	it("keeps one open poll_summary row per poll, with no poll text", async () => {
		const ip = newIp();
		const body = validBody();
		await post(body, { ip });
		await post(body, { ip });
		const row = await readPollRow(body.id);

		const { results } = await env.KPI_DB.prepare("SELECT * FROM poll_summary WHERE poll_id = ?").bind(body.id).all();
		expect(results).toEqual([
			{
				poll_id: body.id,
				created_at: row.created_at,
				duration_sec: 300,
				closes_at: row.closes_at,
				option_count: 3,
				closed_at: null,
				closed_by: null,
				total_votes: null,
				counts_json: null,
			},
		]);
	});

	it("still opens the poll when the KPI write fails", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		const brokenKpiDb = {
			prepare() {
				throw new Error("D1 is down");
			},
		} as unknown as D1Database;
		const ip = newIp();
		const body = validBody();

		const response = await post(body, { ip, bindings: { ...env, KPI_DB: brokenKpiDb } });

		expect(response.status).toBe(201);
		expect(logged).toHaveBeenCalledOnce();
		expect((await post(body, { ip })).status).toBe(200);
		logged.mockRestore();
	});
});
