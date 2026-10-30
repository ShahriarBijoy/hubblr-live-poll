import type { PollSummary } from "@poll-request/domain";

export type OpenSummaryColumns = Pick<PollSummary, "pollId" | "createdAt" | "durationSec" | "closesAt" | "optionCount">;

// OR IGNORE: a replayed create must not touch a row that exists, and the alarm may already have finalized it.
export async function insertOpenSummary(db: D1Database, summary: OpenSummaryColumns): Promise<void> {
	await db
		.prepare(
			`INSERT OR IGNORE INTO poll_summary (poll_id, created_at, duration_sec, closes_at, option_count)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(summary.pollId, summary.createdAt, summary.durationSec, summary.closesAt, summary.optionCount)
		.run();
}

export type FinalSummary = Extract<PollSummary, { closedAt: number }>;

// Writes the open columns too, so this repairs an open row that was lost (that write is best effort). A second run
// writes the same row.
export async function upsertFinalSummary(db: D1Database, summary: FinalSummary): Promise<void> {
	await db
		.prepare(
			`INSERT INTO poll_summary
				(poll_id, created_at, duration_sec, closes_at, option_count, closed_at, closed_by, total_votes, counts_json)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (poll_id) DO UPDATE SET
				created_at = excluded.created_at,
				duration_sec = excluded.duration_sec,
				closes_at = excluded.closes_at,
				option_count = excluded.option_count,
				closed_at = excluded.closed_at,
				closed_by = excluded.closed_by,
				total_votes = excluded.total_votes,
				counts_json = excluded.counts_json`,
		)
		.bind(
			summary.pollId,
			summary.createdAt,
			summary.durationSec,
			summary.closesAt,
			summary.optionCount,
			summary.closedAt,
			summary.closedBy,
			summary.totalVotes,
			JSON.stringify(summary.counts),
		)
		.run();
}
