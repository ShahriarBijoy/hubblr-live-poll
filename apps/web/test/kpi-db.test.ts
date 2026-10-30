import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("KPI_DB poll_summary", () => {
	it("keeps one open row per poll and accepts only the creator or the timer as the closer", async () => {
		const insertOpenRow = env.KPI_DB.prepare(
			"INSERT OR IGNORE INTO poll_summary (poll_id, created_at, duration_sec, closes_at, option_count) VALUES (?, ?, ?, ?, ?)",
		).bind("Ab3_-xYz09", 1_000, 300, 301_000, 3);
		await insertOpenRow.run();
		await insertOpenRow.run();

		const { results } = await env.KPI_DB.prepare("SELECT * FROM poll_summary").all();
		expect(results).toEqual([
			{
				poll_id: "Ab3_-xYz09",
				created_at: 1_000,
				duration_sec: 300,
				closes_at: 301_000,
				option_count: 3,
				closed_at: null,
				closed_by: null,
				total_votes: null,
				counts_json: null,
			},
		]);

		await expect(
			env.KPI_DB.prepare("UPDATE poll_summary SET closed_by = 'reviewer' WHERE poll_id = ?").bind("Ab3_-xYz09").run(),
		).rejects.toThrow(/CHECK constraint failed/);
	});
});
