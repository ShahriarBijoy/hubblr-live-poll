import { api, ms, numbers, openLoop, percentiles, pool, start } from "./lib.mjs";

const { base, values } = start(
	"node scripts/load/vote-latency.mjs <baseUrl> [--rates 5,20,50] [--seconds 10] [--ramp 100,200] [--ramp-seconds 5]",
	{
		rates: { type: "string", default: "5,20,50" },
		seconds: { type: "string", default: "10" },
		ramp: { type: "string", default: "100,200" },
		"ramp-seconds": { type: "string", default: "5" },
	},
);
const phases = [
	...numbers(values.rates).map((rate) => ({ rate, seconds: Number(values.seconds) })),
	...numbers(values.ramp).map((rate) => ({ rate, seconds: Number(values["ramp-seconds"]) })),
];
const client = api(base);

const baseline = [];
for (let i = 0; i < 10; i++) {
	const startedAt = performance.now();
	await client.health();
	baseline.push(performance.now() - startedAt);
}
console.log(`baseline GET /api/health p50 ${ms(percentiles(baseline).p50)} ms (10 sequential)`);

await client.createPoll("Load test: vote latency", 600);
const totalVotes = phases.reduce((sum, { rate, seconds }) => sum + rate * seconds, 0);
const cookies = await pool(totalVotes, 20, () => client.mintVoter());
console.log(`poll ${client.poll.id}, ${cookies.length} voter cookies minted`);

const rows = [];
let used = 0;
for (const { rate, seconds } of phases) {
	const phaseCookies = cookies.slice(used, used + rate * seconds);
	used += phaseCookies.length;
	const { results, achievedRate } = await openLoop(phaseCookies.length, rate, async (index) => {
		const startedAt = performance.now();
		const status = await client.vote(phaseCookies[index], (index % 2) + 1);
		return { status, latency: performance.now() - startedAt };
	});
	const others = {};
	for (const { status } of results) if (status !== 200) others[status] = (others[status] ?? 0) + 1;
	const { p50, p95, p99, max } = percentiles(results.map(({ latency }) => latency));
	rows.push({
		rate,
		sent: results.length,
		ok: results.filter(({ status }) => status === 200).length,
		other: Object.entries(others).map(([status, count]) => `${status}x${count}`).join(" ") || "-",
		p50: ms(p50),
		p95: ms(p95),
		p99: ms(p99),
		max: ms(max),
		achieved: Number(achievedRate.toFixed(1)),
	});
}
console.table(rows);

const okTotal = rows.reduce((sum, { ok }) => sum + ok, 0);
const { totalVotes: finalTotal } = await client.readPoll();
const match = finalTotal === okTotal;
console.log(`final totalVotes ${finalTotal}, 200 count ${okTotal}: ${match ? "match" : "MISMATCH"}`);
// The poll's close alarm fires once more, after the run.
console.log(`Durable Object requests used, estimated: ${client.usage.doRequests + 1}`);
process.exit(match ? 0 : 1);
