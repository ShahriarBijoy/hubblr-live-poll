import { randomBytes } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function start(usage, options) {
	const { values, positionals } = parseArgs({ options, allowPositionals: true });
	if (positionals.length !== 1) {
		console.error(`Usage: ${usage}`);
		process.exit(1);
	}
	const base = new URL(positionals[0]).origin;
	const script = path.relative(process.cwd(), process.argv[1]);
	console.log(`command  node ${[script, ...process.argv.slice(2)].join(" ")}`);
	console.log(`base     ${base}`);
	console.log(`date     ${new Date().toISOString()}`);
	return { base, values };
}

export const numbers = (list) => list.split(",").filter(Boolean).map(Number);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every call below reaches PollRoom once, so counting calls estimates the Durable Object requests billed.
export function api(base) {
	const usage = { doRequests: 0 };
	const call = async (pathname, init = {}) => {
		usage.doRequests++;
		return fetch(`${base}${pathname}`, init);
	};
	const poll = {
		id: Array.from(randomBytes(10), (byte) => ALPHABET[byte & 63]).join(""),
		adminToken: randomBytes(32).toString("base64url"),
	};
	const creator = { authorization: `Bearer ${poll.adminToken}` };
	return {
		usage,
		poll,
		async health() {
			const response = await call("/api/health");
			await response.text();
			if (!response.ok) throw new Error(`GET /api/health answered ${response.status}`);
		},
		async createPoll(question, durationSec) {
			const response = await call("/api/polls", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: poll.id, question, options: ["A", "B"], durationSec, tone: "flame", adminToken: poll.adminToken }),
			});
			if (!response.ok) throw new Error(`POST /api/polls answered ${response.status}: ${await response.text()}`);
		},
		async mintVoter() {
			const response = await call(`/pr/${poll.id}`, { redirect: "manual" });
			await response.text();
			const cookie = response.headers.get("set-cookie");
			if (cookie === null) throw new Error(`GET /pr/${poll.id} answered ${response.status} with no voter cookie`);
			return cookie.split(";")[0];
		},
		// A failed vote is a result to count, so a network error comes back as a status instead of a throw.
		async vote(cookie, optionId) {
			try {
				const response = await call(`/api/polls/${poll.id}/vote`, {
					method: "PUT",
					headers: { "content-type": "application/json", cookie },
					body: JSON.stringify({ optionId }),
				});
				await response.text();
				return response.status;
			} catch (error) {
				return `ERR_${error.cause?.code ?? error.message}`;
			}
		},
		async creatorTicket() {
			const response = await call(`/api/polls/${poll.id}/live-ticket`, { method: "POST", headers: creator });
			if (!response.ok) throw new Error(`POST live-ticket answered ${response.status}`);
			return (await response.json()).ticket;
		},
		async readPoll() {
			const response = await call(`/api/polls/${poll.id}`, { headers: creator });
			if (!response.ok) throw new Error(`GET /api/polls/${poll.id} answered ${response.status}`);
			return response.json();
		},
		liveUrl(ticket) {
			usage.doRequests++;
			return `${base.replace(/^http/, "ws")}/api/polls/${poll.id}/live?ticket=${encodeURIComponent(ticket)}`;
		},
	};
}

export async function pool(count, concurrency, task) {
	const results = new Array(count);
	let next = 0;
	const worker = async () => {
		while (next < count) {
			const index = next++;
			results[index] = await task(index);
		}
	};
	await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
	return results;
}

// Open loop: each send starts on its own schedule, whether or not earlier responses came back.
export async function openLoop(count, rate, send) {
	const startedAt = performance.now();
	const sentAt = [];
	const inFlight = [];
	for (let index = 0; index < count; index++) {
		const due = startedAt + (index * 1000) / rate;
		const wait = due - performance.now();
		if (wait > 0) await sleep(wait);
		sentAt.push(performance.now());
		inFlight.push(send(index));
	}
	const achievedRate = count > 1 ? (count - 1) / ((sentAt.at(-1) - sentAt[0]) / 1000) : rate;
	return { results: await Promise.all(inFlight), achievedRate };
}

export function percentiles(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const at = (p) => (sorted.length === 0 ? NaN : sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]);
	return { p50: at(50), p95: at(95), p99: at(99), max: sorted.at(-1) ?? NaN };
}

export const ms = (value) => (Number.isNaN(value) ? "-" : Math.round(value));
