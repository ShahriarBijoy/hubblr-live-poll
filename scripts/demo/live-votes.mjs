import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

// Casts votes one at a time, each from a new voter, so a results screen visibly moves during a demo.
const USAGE = `node scripts/demo/live-votes.mjs <url> [--votes 30] [--rate 2]

  <url>     The site, to create a demo poll and print its admin link.
            Or a poll link copied from the browser (/pr/{pollId}...), to vote on that poll.
  --votes   How many votes to cast (default 30).
  --rate    Votes per second (default 2).`;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DEMO_POLL = {
	question: "Where should we go for the team lunch?",
	options: ["Pizza place", "Sushi bar", "Food trucks"],
};

const { values, positionals } = parseArgs({
	options: { votes: { type: "string", default: "30" }, rate: { type: "string", default: "2" } },
	allowPositionals: true,
});
if (positionals.length !== 1) {
	console.error(`Usage: ${USAGE}`);
	process.exit(1);
}
const target = new URL(positionals[0]);
const base = target.origin;
const totalVotes = Number(values.votes);
const gapMs = 1000 / Number(values.rate);
if (!(totalVotes > 0) || !(gapMs > 0)) {
	console.error(`--votes and --rate must be positive numbers.\n\nUsage: ${USAGE}`);
	process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createDemoPoll() {
	const id = Array.from(randomBytes(10), (byte) => ALPHABET[byte & 63]).join("");
	const adminToken = randomBytes(32).toString("base64url");
	const response = await fetch(`${base}/api/polls`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ id, ...DEMO_POLL, durationSec: 900, tone: "flame", adminToken }),
	});
	if (!response.ok) throw new Error(`Creating the poll answered ${response.status}: ${await response.text()}`);
	return { id, authorization: `Bearer ${adminToken}`, snapshot: await response.json(), manageUrl: `${base}/pr/${id}/manage#${adminToken}` };
}

async function existingPoll(id) {
	const response = await fetch(`${base}/api/polls/${id}`);
	if (!response.ok) throw new Error(`Reading poll ${id} answered ${response.status}: ${await response.text()}`);
	return { id, authorization: null, snapshot: await response.json(), manageUrl: null };
}

async function newVoter(id) {
	const response = await fetch(`${base}/pr/${id}`, { redirect: "manual" });
	await response.text();
	const cookie = response.headers.get("set-cookie");
	if (cookie === null) throw new Error(`Opening the vote page answered ${response.status} without a voter cookie.`);
	return cookie.split(";")[0];
}

// The first answer leads early, then the second overtakes it, so the audience sees the lead change hands.
function pickOption(options, index) {
	const early = index < totalVotes * 0.4;
	const weights = options.map((_, i) => (i === 0 ? (early ? 5 : 1) : i === 1 ? (early ? 1 : 6) : 2));
	let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
	for (const [i, option] of options.entries()) {
		roll -= weights[i] ?? 0;
		if (roll <= 0) return option;
	}
	return options[options.length - 1];
}

async function waitToStart(message) {
	if (!process.stdin.isTTY) {
		console.log(`${message} Starting in 3 seconds.`);
		await sleep(3000);
		return;
	}
	const prompt = createInterface({ input: process.stdin, output: process.stdout });
	await prompt.question(`${message} Press Enter to start voting.`);
	prompt.close();
}

const pollIdInLink = /\/pr\/([A-Za-z0-9_-]{10})/.exec(target.pathname)?.[1];
const poll = pollIdInLink ? await existingPoll(pollIdInLink) : await createDemoPoll();
if (poll.snapshot.status.kind !== "open") {
	console.error(`Poll ${poll.id} is closed, so it takes no more votes.`);
	process.exit(1);
}

console.log(`Poll: ${poll.snapshot.question}`);
if (poll.manageUrl) {
	console.log(`\nOpen this admin link to watch the results live:\n\n  ${poll.manageUrl}\n`);
}
await waitToStart(`${totalVotes} votes at ${values.rate} per second.`);

let counted = 0;
let lastCookie = null;
for (let index = 0; index < totalVotes; index++) {
	const startedAt = Date.now();
	const option = pickOption(poll.snapshot.options, index);
	const cookie = await newVoter(poll.id);
	const response = await fetch(`${base}/api/polls/${poll.id}/vote`, {
		method: "PUT",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ optionId: option.id }),
	});
	await response.text();
	const label = `${String(index + 1).padStart(String(totalVotes).length)}/${totalVotes}  ${option.label}`;
	if (response.status === 200) {
		counted++;
		lastCookie = cookie;
		console.log(label);
	} else if (response.status === 410) {
		console.log(`${label}  (the poll closed, stopping)`);
		break;
	} else {
		console.log(`${label}  (answered ${response.status})`);
	}
	await sleep(Math.max(0, gapMs - (Date.now() - startedAt)));
}

// The creator, or a voter who just voted, may read the counts.
const headers = poll.authorization ? { authorization: poll.authorization } : lastCookie ? { cookie: lastCookie } : {};
const final = await (await fetch(`${base}/api/polls/${poll.id}`, { headers })).json();
console.log(`\n${counted} of ${totalVotes} votes counted. Total on the poll: ${final.totalVotes}.`);
for (const option of final.options) {
	console.log(`  ${option.label}: ${final.results?.counts?.[option.id] ?? "hidden"}`);
}
