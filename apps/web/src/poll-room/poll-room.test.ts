import { AdminToken, CreatePollCommand, RETENTION_MS, toneFromId, type PollSnapshot } from "@poll-request/domain";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashAdminToken, type AdminTokenHash } from "../platform/admin-token";
import { toBase64Url } from "../platform/base64url";
import { ensureVoter } from "../platform/voter-cookie";
import { handleCastVote } from "../slices/cast-vote/cast-vote.handler";
import { handleClosePoll } from "../slices/close-poll/close-poll.handler";
import { handleLiveTicket, routeLiveSocket } from "../slices/live-results/live-results.handler";
import { handleGetPoll } from "../slices/view-results/view-results.handler";
import { broadcastIntervalMs } from "./poll-room";
import { pollRepository } from "./poll-repository";

describe("broadcastIntervalMs", () => {
	it.each([
		[0, 200],
		[150, 200],
		[500, 500],
		[1_000, 1_000],
		[10_000, 1_000],
	])("waits %i viewers → %i ms between updates", (viewers, interval) => {
		expect(broadcastIntervalMs(viewers)).toBe(interval);
	});
});

describe("PollRoom tone", () => {
	it("stores the creator's tone with the poll", async () => {
		const id = "tone000001";
		const command = CreatePollCommand.parse({ id, question: "Tabs?", options: ["Yes", "No"], durationSec: 300, tone: "truffle" });
		const result = await env.POLL_ROOM.getByName(id).create(command, "hash" as AdminTokenHash);

		expect(result).toMatchObject({ kind: "created", snapshot: { tone: "truffle" } });
		await runInDurableObject(env.POLL_ROOM.getByName(id), (_instance, state) => {
			expect(pollRepository(state.storage).load()?.poll.tone).toBe("truffle");
		});
	});

	it("adds the tone column to a room stored before tones, once, and derives the tone from the poll ID", async () => {
		const id = "legacy0001";
		await runInDurableObject(env.POLL_ROOM.getByName(id), (_instance, state) => {
			const { sql } = state.storage;
			sql.exec(`CREATE TABLE poll (id TEXT PRIMARY KEY, question TEXT NOT NULL, admin_token_hash TEXT NOT NULL,
				created_at INTEGER NOT NULL, closes_at INTEGER NOT NULL, closed_at INTEGER, summary_exported_at INTEGER)`);
			sql.exec("CREATE TABLE option (id INTEGER PRIMARY KEY, label TEXT NOT NULL, position INTEGER NOT NULL)");
			sql.exec("INSERT INTO poll (id, question, admin_token_hash, created_at, closes_at) VALUES (?, 'Tabs?', 'h', 1, 2)", id);

			const repository = pollRepository(state.storage);
			repository.addToneColumn();
			repository.addToneColumn();

			expect(repository.load()?.poll.tone).toBe(toneFromId(id));
		});
	});
});

describe("PollRoom.ping", () => {
	it("counts the application tables in the room's own SQLite database", async () => {
		const room = env.POLL_ROOM.getByName("ping-test");
		expect(await room.ping()).toEqual({ sqliteTables: 0 });

		await runInDurableObject(room, (_instance, state) => {
			state.storage.sql.exec("CREATE TABLE poll (id TEXT)");
			state.storage.sql.exec("CREATE TABLE _runtime_internal (id TEXT)");
		});

		expect(await room.ping()).toEqual({ sqliteTables: 1 });
		expect(await env.POLL_ROOM.getByName("other-room").ping()).toEqual({ sqliteTables: 0 });
	});
});

// One socket's messages in arrival order, so a test can await them one at a time.
function messagesOf(ws: WebSocket): () => Promise<PollSnapshot> {
	const arrived: PollSnapshot[] = [];
	const waiting: ((snapshot: PollSnapshot) => void)[] = [];
	ws.addEventListener("message", (event) => {
		const snapshot = JSON.parse(String(event.data)) as PollSnapshot;
		const resolve = waiting.shift();
		if (resolve === undefined) arrived.push(snapshot);
		else resolve(snapshot);
	});
	ws.accept();
	return () => {
		const next = arrived.shift();
		return next === undefined ? new Promise((resolve) => waiting.push(resolve)) : Promise.resolve(next);
	};
}

const origin = "https://poll.test";

async function voterCookie(): Promise<string> {
	const { setCookie } = await ensureVoter(new Request(`${origin}/`), env.VOTER_SECRET);
	return setCookie?.split(";")[0] ?? "";
}

function vote(pollId: string, cookie: string, optionId: number): Promise<Response> {
	const request = new Request(`${origin}/api/polls/${pollId}/vote`, {
		method: "PUT",
		headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.200", Cookie: cookie },
		body: JSON.stringify({ optionId }),
	});
	return handleCastVote(request, pollId, { env });
}

async function connect(pollId: string, cookie: string): Promise<{ ws: WebSocket; next: () => Promise<PollSnapshot> }> {
	const ticketResponse = await handleLiveTicket(
		new Request(`${origin}/api/polls/${pollId}/live-ticket`, { method: "POST", headers: { Cookie: cookie } }),
		pollId,
		{ env },
	);
	const { ticket } = await ticketResponse.json<{ ticket: string }>();
	const request = new Request(`${origin}/api/polls/${pollId}/live?ticket=${encodeURIComponent(ticket)}`, {
		headers: { Upgrade: "websocket", Origin: origin },
	});
	const response = await routeLiveSocket(request, pollId, { env });
	const ws = response.webSocket;
	if (ws === null) throw new Error(`expected an upgrade, got ${response.status}`);
	return { ws, next: messagesOf(ws) };
}

describe("PollRoom live sockets", () => {
	const pollId = "socket0001";

	it("sends the snapshot on connect, the new count after a vote, and the viewer count after a close", async () => {
		const command = CreatePollCommand.parse({
			id: pollId,
			question: "Tabs?",
			options: ["Yes", "No"],
			durationSec: 300,
			tone: "flame",
		});
		await env.POLL_ROOM.getByName(pollId).create(command, "hash" as AdminTokenHash);
		const [first, second] = [await voterCookie(), await voterCookie()];
		await vote(pollId, first, 1);
		await vote(pollId, second, 1);

		const a = await connect(pollId, first);
		expect(await a.next()).toMatchObject({ viewers: 1, totalVotes: 2, myOptionId: null, results: { version: 2 } });

		const b = await connect(pollId, second);
		expect(await b.next()).toMatchObject({ viewers: 2 });
		expect(await a.next()).toMatchObject({ viewers: 2 });

		const third = await voterCookie();
		await vote(pollId, third, 2);
		expect(await a.next()).toMatchObject({ totalVotes: 3, results: { counts: { 1: 2, 2: 1 }, version: 3 } });
		expect(await b.next()).toMatchObject({ totalVotes: 3 });

		b.ws.close(1000);
		expect(await a.next()).toMatchObject({ viewers: 1, totalVotes: 3 });
		a.ws.close(1000);
	});
});

function newToken(): AdminToken {
	return AdminToken.parse(toBase64Url(crypto.getRandomValues(new Uint8Array(32))));
}

let sequence = 0;
async function openPoll(token: AdminToken): Promise<string> {
	sequence += 1;
	const id = `a${String(sequence).padStart(9, "0")}`;
	const command = CreatePollCommand.parse({
		id,
		question: "Tabs?",
		options: ["Yes", "No"],
		durationSec: 300,
		tone: "flame",
	});
	await env.POLL_ROOM.getByName(id).create(command, await hashAdminToken(token));
	return id;
}

function closeAsCreator(pollId: string, token: AdminToken): Promise<Response> {
	const request = new Request(`${origin}/api/polls/${pollId}/close`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "cf-connecting-ip": "203.0.113.200" },
	});
	return handleClosePoll(request, pollId, { env });
}

// Moves the poll's clock back, so its close lies `msAgo` in the past. The CHECK only binds closed_at, which stays empty.
function closeByTimer(pollId: string, msAgo: number): Promise<void> {
	return runInDurableObject(env.POLL_ROOM.getByName(pollId), (_room, state) => {
		const closesAt = Date.now() - msAgo;
		state.storage.sql.exec("UPDATE poll SET created_at = ?, closes_at = ?", closesAt - 300_000, closesAt);
	});
}

type RoomState = { alarm: number | null; closesAt: number; summaryExportedAt: number | null };

function roomState(pollId: string): Promise<RoomState> {
	return runInDurableObject(env.POLL_ROOM.getByName(pollId), async (_room, state) => {
		const row = state.storage.sql
			.exec<{ closes_at: number; summary_exported_at: number | null }>("SELECT closes_at, summary_exported_at FROM poll")
			.one();
		return { alarm: await state.storage.getAlarm(), closesAt: row.closes_at, summaryExportedAt: row.summary_exported_at };
	});
}

function summaryRow(pollId: string): Promise<Record<string, unknown> | null> {
	return env.KPI_DB.prepare("SELECT * FROM poll_summary WHERE poll_id = ?").bind(pollId).first();
}

async function getStatus(pollId: string): Promise<number> {
	return (await handleGetPoll(new Request(`${origin}/api/polls/${pollId}`), pollId, { env })).status;
}

describe("closing a poll", () => {
	it("answers a vote after the creator's close with 410", async () => {
		const token = newToken();
		const pollId = await openPoll(token);

		expect((await closeAsCreator(pollId, token)).status).toBe(200);

		expect((await vote(pollId, await voterCookie(), 1)).status).toBe(410);
	});

	it("sends an open socket the final snapshot, then closes it with the reason poll-closed", async () => {
		const token = newToken();
		const pollId = await openPoll(token);
		const cookie = await voterCookie();
		await vote(pollId, cookie, 1);
		const socket = await connect(pollId, cookie);
		await socket.next();
		const closed = new Promise<CloseEvent>((resolve) => socket.ws.addEventListener("close", resolve));

		await closeAsCreator(pollId, token);
		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));

		expect(await socket.next()).toMatchObject({ status: { kind: "closed", closedBy: "creator" }, totalVotes: 1 });
		expect(await closed).toMatchObject({ code: 1000, reason: "poll-closed" });
	});
});

describe("PollRoom.alarm", () => {
	it("sets the alarm to closesAt at create, and again when it runs on an open poll", async () => {
		const pollId = await openPoll(newToken());
		const { closesAt, alarm } = await roomState(pollId);
		expect(alarm).toBe(closesAt);

		expect(await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId))).toBe(true);

		expect(await roomState(pollId)).toEqual({ alarm: closesAt, closesAt, summaryExportedAt: null });
	});

	it("exports the final summary of a closed poll and waits seven days, the same on a second run", async () => {
		const pollId = await openPoll(newToken());
		const [first, second] = [await voterCookie(), await voterCookie()];
		await vote(pollId, first, 2);
		await vote(pollId, second, 2);
		await closeByTimer(pollId, 1_000);

		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));
		const afterFirst = await roomState(pollId);
		const rowAfterFirst = await summaryRow(pollId);
		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));

		expect(afterFirst.summaryExportedAt).not.toBeNull();
		expect(afterFirst.alarm).toBe(afterFirst.closesAt + RETENTION_MS);
		expect(rowAfterFirst).toMatchObject({
			closes_at: afterFirst.closesAt,
			duration_sec: 300,
			option_count: 2,
			closed_at: afterFirst.closesAt,
			closed_by: "timer",
			total_votes: 2,
			counts_json: "[0,2]",
		});
		expect(await roomState(pollId)).toEqual(afterFirst);
		expect(await summaryRow(pollId)).toEqual(rowAfterFirst);
	});

	it("deletes the poll seven days after the close and keeps the summary row", async () => {
		const pollId = await openPoll(newToken());
		await vote(pollId, await voterCookie(), 1);
		await closeByTimer(pollId, 1_000);
		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));
		await closeByTimer(pollId, RETENTION_MS);

		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));

		expect(await getStatus(pollId)).toBe(404);
		expect(await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId))).toBe(false);
		expect(await summaryRow(pollId)).toMatchObject({ closed_by: "timer", total_votes: 1, counts_json: "[1,0]" });
	});

	// A trigger makes the real D1 refuse this one poll's row, so the code under test needs no seam.
	it("keeps the poll data and retries in 60 s when the D1 write fails, even after seven days", async () => {
		const pollId = await openPoll(newToken());
		await closeByTimer(pollId, RETENTION_MS + 1_000);
		await env.KPI_DB.exec(
			`CREATE TRIGGER fail_${pollId} BEFORE INSERT ON poll_summary WHEN NEW.poll_id = '${pollId}' BEGIN SELECT RAISE(ABORT, 'D1 is down'); END`,
		);

		const before = Date.now();
		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));
		const after = Date.now();

		const state = await roomState(pollId);
		expect(state.summaryExportedAt).toBeNull();
		expect(state.alarm).toBeGreaterThanOrEqual(before + 60_000);
		expect(state.alarm).toBeLessThanOrEqual(after + 60_000);
		expect(await getStatus(pollId)).toBe(200);
		expect(await summaryRow(pollId)).toBeNull();

		await env.KPI_DB.exec(`DROP TRIGGER fail_${pollId}`);
		await runDurableObjectAlarm(env.POLL_ROOM.getByName(pollId));

		expect(await summaryRow(pollId)).toMatchObject({ closed_by: "timer", total_votes: 0, counts_json: "[0,0]" });
		expect(await getStatus(pollId)).toBe(404);
	});
});
