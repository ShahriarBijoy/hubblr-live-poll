import {
	alarmStep,
	pollStatus,
	pollSummary,
	type CreatePollCommand,
	type OptionId,
	type VoterId,
} from "@poll-request/domain";
import { DurableObject } from "cloudflare:workers";
import type { AdminTokenHash } from "../platform/admin-token";
import { upsertFinalSummary } from "../platform/kpi-store";
import { castVoteInRoom, voteViewInRoom, type CastVoteResult } from "../slices/cast-vote/cast-vote.room";
import type { VoteViewResult } from "../slices/cast-vote/cast-vote.schema";
import { closePollInRoom, type ClosePollResult } from "../slices/close-poll/close-poll.room";
import { createPollInRoom, type CreatePollResult } from "../slices/create-poll/create-poll.room";
import {
	liveAccessInRoom,
	liveSnapshotInRoom,
	pollStateInRoom,
	type LiveAccess,
} from "../slices/live-results/live-results.room";
import { readResultsInRoom } from "../slices/view-results/view-results.room";
import type { ResultsResult } from "../slices/view-results/view-results.schema";
import { pollRepository, type RoomContext } from "./poll-repository";

export type PingResult = { sqliteTables: number };

const EXPORT_RETRY_MS = 60_000;

// One millisecond per open socket, between 200 ms and 1 s. This one object sends each update once per socket, so up
// to 1,000 viewers a crowded poll stays near 1,000 sends a second, instead of 5 updates a second to every socket.
export function broadcastIntervalMs(viewers: number): number {
	return Math.min(1_000, Math.max(200, viewers));
}

export class PollRoom extends DurableObject<Env> {
	// In memory only. After hibernation the throttle starts fresh, which can only send one snapshot sooner.
	private lastBroadcastAt = 0;
	private trailingBroadcast: ReturnType<typeof setTimeout> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// The runtime answers the client's keepalive itself, so a ping never wakes a hibernating object.
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
		// Polls created before alarms existed have no alarm, and polls created before tones have no tone column. A deploy
		// restarts every object, so the first request after it adds the column and sets an alarm, and alarm() then
		// schedules the right time.
		void this.ctx.blockConcurrencyWhile(async () => {
			const repository = pollRepository(this.ctx.storage);
			repository.addToneColumn();
			if (repository.load() !== null && (await this.ctx.storage.getAlarm()) === null) {
				await this.ctx.storage.setAlarm(Date.now());
			}
		});
	}

	// workerd refuses sqlite_version() and similar introspection, so the read is a table count.
	// Names starting with "_" belong to the runtime (_cf_* in production, __miniflare_do_name locally).
	ping(): PingResult {
		const row = this.ctx.storage.sql
			.exec<{ tables: number }>(
				"SELECT count(*) AS tables FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 1) <> '_'",
			)
			.one();
		return { sqliteTables: row.tables };
	}

	// Each read, decision, and write runs before the first await, so no other request runs in between.
	async create(command: CreatePollCommand, adminTokenHash: AdminTokenHash): Promise<CreatePollResult> {
		const result = createPollInRoom(pollRepository(this.ctx.storage), command, adminTokenHash, this.roomContext());
		if (result.kind === "created") await this.ctx.storage.setAlarm(result.summary.closesAt);
		return result;
	}

	// The alarm closes the sockets and writes the summary, so the creator and the timer share one procedure.
	async close(adminTokenHash: AdminTokenHash): Promise<ClosePollResult> {
		const result = closePollInRoom(pollRepository(this.ctx.storage), adminTokenHash, this.roomContext());
		if (result.kind === "closed") await this.ctx.storage.setAlarm(Date.now());
		return result;
	}

	vote(voterId: VoterId, optionId: OptionId): CastVoteResult {
		const result = castVoteInRoom(pollRepository(this.ctx.storage), voterId, optionId, this.roomContext());
		if (result.kind === "recorded") this.broadcast();
		return result;
	}

	voteView(voterId: VoterId): VoteViewResult {
		return voteViewInRoom(pollRepository(this.ctx.storage), voterId, this.roomContext());
	}

	results(voterId: VoterId | null, adminTokenHash: AdminTokenHash | null): ResultsResult {
		return readResultsInRoom(pollRepository(this.ctx.storage), voterId, adminTokenHash, this.roomContext());
	}

	liveAccess(voterId: VoterId | null, adminTokenHash: AdminTokenHash | null): LiveAccess {
		return liveAccessInRoom(pollRepository(this.ctx.storage), voterId, adminTokenHash, this.roomContext());
	}

	// Each step comes from the stored data, so a second run, or a run that Cloudflare retries, ends in the same state.
	override async alarm(): Promise<void> {
		const repository = pollRepository(this.ctx.storage);
		for (;;) {
			const stored = repository.load();
			if (stored === null) return;
			const now = Date.now();
			const step = alarmStep(stored.poll, stored.summaryExportedAt, now);
			switch (step.kind) {
				case "wait":
					await this.ctx.storage.setAlarm(step.until);
					return;
				case "delete":
					await this.ctx.storage.deleteAll();
					return;
				case "export": {
					this.closeSockets();
					const summary = pollSummary(stored.poll, pollStatus(stored.poll, now), repository.countsByOptionId());
					if (summary.closedAt === null) throw new Error("alarmStep exported an open poll.");
					try {
						await upsertFinalSummary(this.env.KPI_DB, summary);
					} catch (error) {
						// Our own retry, so a long D1 outage does not use up the automatic alarm retries.
						console.error("poll_summary: the final row was not written, retrying in 60 s", {
							pollId: stored.poll.id,
							error,
						});
						await this.ctx.storage.setAlarm(Date.now() + EXPORT_RETRY_MS);
						return;
					}
					repository.markSummaryExported(Date.now());
				}
			}
		}
	}

	// Only routeLiveSocket calls this, after it checked the ticket and the Origin.
	override fetch(): Response {
		const state = pollStateInRoom(pollRepository(this.ctx.storage), Date.now());
		if (state === "not-found") return new Response("Not Found", { status: 404 });
		if (state === "closed") return new Response("Gone", { status: 410 });
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		this.broadcast();
		return new Response(null, { status: 101, webSocket: client });
	}

	override webSocketClose(): void {
		this.broadcast();
	}

	override webSocketError(): void {
		this.broadcast();
	}

	// The final snapshot, then the close reason that tells each client not to connect again.
	private closeSockets(): void {
		if (this.trailingBroadcast !== null) clearTimeout(this.trailingBroadcast);
		this.trailingBroadcast = null;
		this.sendSnapshot();
		for (const ws of this.ctx.getWebSockets()) ws.close(1000, "poll-closed");
	}

	private roomContext(): RoomContext {
		return { now: Date.now(), viewers: this.ctx.getWebSockets().length };
	}

	// Always on a timer, never inside the request, so a vote answers without waiting for the sends. Changes inside the
	// window share one trailing send, which reads the state then.
	private broadcast(): void {
		if (this.trailingBroadcast !== null) return;
		const interval = broadcastIntervalMs(this.ctx.getWebSockets().length);
		const wait = Math.max(0, this.lastBroadcastAt + interval - Date.now());
		this.trailingBroadcast = setTimeout(() => {
			this.trailingBroadcast = null;
			this.sendSnapshot();
		}, wait);
	}

	private sendSnapshot(): void {
		this.lastBroadcastAt = Date.now();
		const sockets = this.ctx.getWebSockets();
		const snapshot = liveSnapshotInRoom(pollRepository(this.ctx.storage), {
			now: Date.now(),
			viewers: sockets.length,
		});
		if (snapshot === null) return;
		const message = JSON.stringify(snapshot);
		// A socket can die between getWebSockets() and send(). Its error must not keep the snapshot from the rest.
		let failed = 0;
		for (const ws of sockets) {
			try {
				ws.send(message);
			} catch {
				failed++;
			}
		}
		if (failed > 0) console.error("broadcast: send failed on some sockets", { failed, sockets: sockets.length });
	}
}
