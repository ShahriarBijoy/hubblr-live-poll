import type { PollSnapshot } from "@poll-request/domain";
import { useMemo, useSyncExternalStore } from "react";

export type LiveState = "connecting" | "live" | "stopped";

const PING_INTERVAL_MS = 30_000;
const FIRST_DELAY_MS = 500;
const MAX_DELAY_MS = 10_000;

// These answers stay the same on a retry: the voter has not voted, the poll is gone, or the poll is closed.
const FINAL_TICKET_STATUSES = new Set([403, 404, 410]);

// 0.5 s, 1 s, 2 s, ... capped at 10 s, each within ±20% so a deploy does not bring every client back at once.
export function reconnectDelay(attempt: number, random: number): number {
	const base = Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** attempt);
	return Math.min(MAX_DELAY_MS, Math.round(base * (0.8 + 0.4 * random)));
}

type LiveOptions = {
	// False for a poll the server already reported closed: it never changes again, so no ticket is asked for.
	enabled: boolean;
	// The manage view passes its Authorization header value, so the ticket request asks as the creator.
	authorization?: string;
};

const NO_CONNECTION = { subscribe: () => () => {}, state: (): LiveState => "stopped" };

// The results of a poll as they change. onSnapshot must keep its identity across renders, or every render reconnects.
export function useLivePoll(
	pollId: string,
	onSnapshot: (snapshot: PollSnapshot) => void,
	{ enabled, authorization }: LiveOptions,
): LiveState {
	const connection = useMemo(
		() => (enabled ? liveConnection(pollId, onSnapshot, authorization) : NO_CONNECTION),
		[enabled, pollId, onSnapshot, authorization],
	);
	return useSyncExternalStore(connection.subscribe, connection.state, () => (enabled ? "connecting" : "stopped"));
}

function liveConnection(pollId: string, onSnapshot: (snapshot: PollSnapshot) => void, authorization?: string) {
	let state: LiveState = "connecting";

	function subscribe(notify: () => void): () => void {
		let stopped = false;
		let attempt = 0;
		let socket: WebSocket | null = null;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let pingTimer: ReturnType<typeof setInterval> | undefined;

		function setState(next: LiveState) {
			state = next;
			notify();
		}

		function retry() {
			setState("connecting");
			retryTimer = setTimeout(() => void open(), reconnectDelay(attempt, Math.random()));
			attempt += 1;
		}

		async function open() {
			let ticket: string;
			try {
				const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}/live-ticket`, {
					method: "POST",
					headers: authorization === undefined ? undefined : { Authorization: authorization },
				});
				if (stopped) return;
				if (FINAL_TICKET_STATUSES.has(response.status)) return setState("stopped");
				if (!response.ok) throw new Error(`The live ticket request answered ${response.status}.`);
				({ ticket } = await response.json<{ ticket: string }>());
			} catch (error) {
				console.error("Could not get a live ticket, retrying.", error);
				if (!stopped) retry();
				return;
			}
			if (stopped) return;

			// ws: only for the local dev server, which runs on plain http.
			const protocol = location.protocol === "https:" ? "wss:" : "ws:";
			const ws = new WebSocket(
				`${protocol}//${location.host}/api/polls/${encodeURIComponent(pollId)}/live?ticket=${encodeURIComponent(ticket)}`,
			);
			socket = ws;
			ws.addEventListener("open", () => {
				attempt = 0;
				setState("live");
				pingTimer = setInterval(() => ws.send("ping"), PING_INTERVAL_MS);
			});
			ws.addEventListener("message", (event) => {
				if (event.data === "pong") return;
				onSnapshot(JSON.parse(String(event.data)) as PollSnapshot);
			});
			ws.addEventListener("close", (event) => {
				clearInterval(pingTimer);
				socket = null;
				if (stopped) return;
				if (event.reason === "poll-closed") setState("stopped");
				else retry();
			});
		}

		void open();
		return () => {
			stopped = true;
			clearTimeout(retryTimer);
			clearInterval(pingTimer);
			socket?.close(1000);
		};
	}

	return { subscribe, state: () => state };
}
