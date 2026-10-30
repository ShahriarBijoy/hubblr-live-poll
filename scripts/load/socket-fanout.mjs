import WebSocket from "ws";
import { api, ms, openLoop, percentiles, pool, sleep, start } from "./lib.mjs";

const { base, values } = start(
	"node scripts/load/socket-fanout.mjs <baseUrl> [--sockets 1000] [--votes 50] [--rate 5]",
	{
		sockets: { type: "string", default: "1000" },
		votes: { type: "string", default: "50" },
		rate: { type: "string", default: "5" },
	},
);
const socketCount = Number(values.sockets);
const voteCount = Number(values.votes);
const client = api(base);

async function until(predicate, timeoutMs) {
	const deadline = performance.now() + timeoutMs;
	while (!predicate() && performance.now() < deadline) await sleep(20);
	return predicate();
}

// reached[n] counts live sockets whose highest totalVotes is at least n. Vote n has fanned out once it equals live.
const reached = [];
const pending = new Map();
const sockets = [];
let live = 0;
let dropped = 0;
let failedToOpen = 0;
let closing = false;

// The slowest socket alone decides "every socket", so the half and 95% marks show whether all screens lag or a few.
function settle() {
	for (const [number, vote] of pending) {
		const count = reached[number] ?? 0;
		if (count >= live / 2) vote.half ??= performance.now() - vote.sentAt;
		if (count >= live * 0.95) vote.most ??= performance.now() - vote.sentAt;
		if (count < live) continue;
		pending.delete(number);
		vote.resolve(performance.now() - vote.sentAt);
	}
}

function openSocket(ticket) {
	const state = { seen: -1, viewers: 0, firstSnapshotAt: null };
	const socket = new WebSocket(client.liveUrl(ticket), { origin: base });
	socket.on("message", (data) => {
		const snapshot = JSON.parse(String(data));
		state.firstSnapshotAt ??= performance.now();
		state.viewers = snapshot.viewers;
		for (let n = Math.max(1, state.seen + 1); n <= snapshot.totalVotes; n++) reached[n] = (reached[n] ?? 0) + 1;
		state.seen = Math.max(state.seen, snapshot.totalVotes);
		settle();
	});
	return new Promise((resolve) => {
		// A stalled handshake neither opens nor errors, and would hang the pool.
		const openTimeout = setTimeout(() => {
			failedToOpen++;
			console.error("socket failed to open: no handshake within 15 s");
			socket.terminate();
			resolve(null);
		}, 15_000);
		socket.once("open", () => {
			clearTimeout(openTimeout);
			live++;
			sockets.push(state);
			socket.on("close", () => {
				if (closing) return;
				dropped++;
				live--;
				for (let n = 1; n <= state.seen; n++) reached[n]--;
				settle();
			});
			resolve(socket);
		});
		socket.once("error", (error) => {
			if (socket.readyState === WebSocket.OPEN) return;
			clearTimeout(openTimeout);
			failedToOpen++;
			console.error(`socket failed to open: ${error.message}`);
			resolve(null);
		});
	});
}

await client.createPoll("Load test: socket fan-out", 600);
console.log(`poll ${client.poll.id}`);

const openStartedAt = performance.now();
const opened = (await pool(socketCount, 50, async () => openSocket(await client.creatorTicket()))).filter(Boolean);
const allSnapshots = await until(() => sockets.every((state) => state.firstSnapshotAt !== null), 30_000);
const lastFirst = Math.max(...sockets.map((state) => state.firstSnapshotAt ?? Infinity));
await until(() => sockets.some((state) => state.viewers === opened.length), 3_000);
const viewers = Math.max(...sockets.map((state) => state.viewers));
const snapshotTime = allSnapshots ? `${ms(lastFirst - openStartedAt)} ms` : "TIMEOUT (30 s)";
console.log(`${opened.length}/${socketCount} sockets open, failed to open ${failedToOpen}`);
console.log(`every socket had a snapshot after ${snapshotTime}, viewers ${viewers}`);

const cookies = await pool(voteCount, 20, () => client.mintVoter());
console.log(`${cookies.length} voter cookies minted`);

const { results, achievedRate } = await openLoop(voteCount, Number(values.rate), async (index) => {
	const vote = { sentAt: performance.now(), half: undefined, most: undefined };
	const fannedOut = new Promise((resolve) => pending.set(index + 1, Object.assign(vote, { resolve })));
	const status = await client.vote(cookies[index], (index % 2) + 1);
	const voteMs = performance.now() - vote.sentAt;
	const fanOut = await Promise.race([fannedOut, sleep(10_000).then(() => null)]);
	return { status, voteMs, fanOut, half: vote.half, most: vote.most };
});
for (const [label, key] of [["half of the sockets", "half"], ["95% of the sockets", "most"]]) {
	const marks = percentiles(results.map((result) => result[key]).filter((value) => value !== undefined));
	console.log(`fan-out to ${label}, ms: p50 ${ms(marks.p50)}  p95 ${ms(marks.p95)}  max ${ms(marks.max)}`);
}
const voteLatency = percentiles(results.map(({ voteMs }) => voteMs));
console.log(`vote request, ms: p50 ${ms(voteLatency.p50)}  p95 ${ms(voteLatency.p95)}  p99 ${ms(voteLatency.p99)}`);
const fanOuts = results.map(({ fanOut }) => fanOut).filter((value) => value !== null);
const notOk = results.filter(({ status }) => status !== 200).map(({ status }) => status);
const { p50, p95, p99, max } = percentiles(fanOuts);
console.log(`votes sent ${results.length} at ${achievedRate.toFixed(1)}/s, non-200: ${notOk.join(" ") || "none"}`);
console.log(`fan-out to every socket, ms: p50 ${ms(p50)}  p95 ${ms(p95)}  p99 ${ms(p99)}  max ${ms(max)}`);
console.log(`votes not seen by every socket within 10 s: ${results.length - fanOuts.length}`);
console.log(`sockets dropped during the run: ${dropped}`);
const finalTotal = Math.max(...sockets.map((state) => state.seen));
console.log(`sockets that saw the final total ${finalTotal}: ${sockets.filter((state) => state.seen === finalTotal).length}/${sockets.length}`);

closing = true;
const allClosed = Promise.all(opened.map((socket) => new Promise((resolve) => socket.once("close", resolve))));
for (const socket of opened) socket.close();
await Promise.race([allClosed, sleep(5_000)]);
// The poll's close alarm fires once more, after the run.
console.log(`Durable Object requests used, estimated: ${client.usage.doRequests + 1}`);
process.exit(0);
