import { execFileSync } from "node:child_process";
import path from "node:path";

// Polls created before alarms existed have no alarm. A GET wakes each open poll's object, and its constructor sets the alarm.
// Usage: node scripts/backfill-alarms.mjs <baseUrl> [wrangler flags, such as --env preview]
const [baseUrl, ...wranglerFlags] = process.argv.slice(2);
if (baseUrl === undefined) {
	console.error("Usage: node scripts/backfill-alarms.mjs <baseUrl> [--env preview]");
	process.exit(1);
}

// wrangler's own entry under node, because pnpm is a .cmd file on Windows that execFileSync cannot start without a shell.
const appDir = path.resolve(import.meta.dirname, "../apps/web");
const output = execFileSync(
	process.execPath,
	[
		path.join(appDir, "node_modules/wrangler/bin/wrangler.js"),
		"d1",
		"execute",
		"KPI_DB",
		"--remote",
		"--json",
		...wranglerFlags,
		"--command",
		"SELECT poll_id FROM poll_summary WHERE closed_at IS NULL",
	],
	{ cwd: appDir, encoding: "utf8" },
);
const pollIds = JSON.parse(output).flatMap((statement) => statement.results.map((row) => row.poll_id));

let woken = 0;
for (const pollId of pollIds) {
	const response = await fetch(new URL(`/api/polls/${encodeURIComponent(pollId)}`, baseUrl));
	if (response.ok) woken += 1;
	else console.error(`backfill-alarms: GET for ${pollId} answered ${response.status}.`);
}
console.log(`backfill-alarms: woke ${woken} of ${pollIds.length} open polls.`);
