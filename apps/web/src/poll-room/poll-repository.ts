import {
	Tone,
	pollSnapshot,
	toneFromId,
	type OptionId,
	type Poll,
	type PollId,
	type PollSnapshot,
	type VoterId,
} from "@poll-request/domain";
import type { AdminTokenHash } from "../platform/admin-token";

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS poll (
		id                  TEXT PRIMARY KEY,
		question            TEXT NOT NULL,
		tone                TEXT,
		admin_token_hash    TEXT NOT NULL,
		created_at          INTEGER NOT NULL,
		closes_at           INTEGER NOT NULL,
		closed_at           INTEGER,
		summary_exported_at INTEGER,
		CHECK (closed_at IS NULL OR closed_at <= closes_at)
	)`,
	`CREATE TABLE IF NOT EXISTS option (
		id       INTEGER PRIMARY KEY,
		label    TEXT NOT NULL,
		position INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS vote (
		voter_id  TEXT PRIMARY KEY,
		option_id INTEGER NOT NULL REFERENCES option(id),
		voted_at  INTEGER NOT NULL
	)`,
	"CREATE INDEX IF NOT EXISTS vote_by_option ON vote(option_id)",
];

const VERSION_KEY = "version";

export type StoredPoll = { poll: Poll; adminTokenHash: AdminTokenHash };

export type LoadedPoll = StoredPoll & { summaryExportedAt: number | null };

// What a PollRoom method knows about the moment of the request, passed to every slice's room function.
export type RoomContext = { now: number; viewers: number };

export type SnapshotViewer = { resultsVisible: boolean; myOptionId: OptionId | null };

type PollRow = {
	id: string;
	question: string;
	tone: string | null;
	admin_token_hash: string;
	created_at: number;
	closes_at: number;
	closed_at: number | null;
	summary_exported_at: number | null;
};

type OptionRow = { id: number; label: string; position: number };

export type PollRepository = ReturnType<typeof pollRepository>;

export function pollRepository(storage: DurableObjectStorage) {
	const { sql } = storage;

	// A read of a room that never held a poll must not create tables, so only insert() runs the schema.
	function hasSchema(): boolean {
		return sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'poll'").toArray().length > 0;
	}

	function countsByOptionId(): Record<number, number> {
		const rows = sql
			.exec<{ option_id: number; votes: number }>("SELECT option_id, count(*) AS votes FROM vote GROUP BY option_id")
			.toArray();
		return Object.fromEntries(rows.map((row) => [row.option_id, row.votes]));
	}

	function version(): number {
		return storage.kv.get<number>(VERSION_KEY) ?? 0;
	}

	return {
		countsByOptionId,

		// Polls stored before tones existed have no tone column. Idempotent, so every constructor may run it.
		addToneColumn(): void {
			if (!hasSchema()) return;
			const columns = sql.exec<{ name: string }>("PRAGMA table_info(poll)").toArray();
			if (!columns.some((column) => column.name === "tone")) sql.exec("ALTER TABLE poll ADD COLUMN tone TEXT");
		},

		load(): LoadedPoll | null {
			if (!hasSchema()) return null;
			const row = sql
				.exec<PollRow>(`SELECT id, question, tone, admin_token_hash, created_at, closes_at, closed_at, summary_exported_at
					FROM poll`)
				.toArray()[0];
			if (row === undefined) return null;
			const options = sql.exec<OptionRow>("SELECT id, label, position FROM option ORDER BY position").toArray();
			return {
				poll: {
					id: row.id as PollId,
					question: row.question,
					options: options.map((option) => ({ ...option, id: option.id as OptionId })),
					tone: Tone.safeParse(row.tone).data ?? toneFromId(row.id),
					createdAt: row.created_at,
					closesAt: row.closes_at,
					closedAt: row.closed_at,
				},
				adminTokenHash: row.admin_token_hash as AdminTokenHash,
				summaryExportedAt: row.summary_exported_at,
			};
		},

		insert({ poll, adminTokenHash }: StoredPoll): void {
			storage.transactionSync(() => {
				for (const statement of SCHEMA) sql.exec(statement);
				sql.exec(
					`INSERT INTO poll (id, question, tone, admin_token_hash, created_at, closes_at, closed_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)`,
					poll.id,
					poll.question,
					poll.tone,
					adminTokenHash,
					poll.createdAt,
					poll.closesAt,
					poll.closedAt,
				);
				for (const option of poll.options) {
					sql.exec("INSERT INTO option (id, label, position) VALUES (?, ?, ?)", option.id, option.label, option.position);
				}
			});
		},

		// Call only after load() returned a poll: the vote table exists exactly when the poll row does.
		voteOf(voterId: VoterId): OptionId | null {
			const rows = sql.exec<{ option_id: number }>("SELECT option_id FROM vote WHERE voter_id = ?", voterId).toArray();
			return rows[0] === undefined ? null : (rows[0].option_id as OptionId);
		},

		// The counts and the version change together or not at all.
		recordVote(voterId: VoterId, optionId: OptionId, votedAt: number): void {
			storage.transactionSync(() => {
				sql.exec(
					`INSERT INTO vote (voter_id, option_id, voted_at) VALUES (?, ?, ?)
					ON CONFLICT (voter_id) DO UPDATE SET option_id = excluded.option_id, voted_at = excluded.voted_at`,
					voterId,
					optionId,
					votedAt,
				);
				storage.kv.put(VERSION_KEY, version() + 1);
			});
		},

		// The status changed, so the version moves too, and a client drops any older snapshot that arrives later.
		closePoll(now: number): void {
			storage.transactionSync(() => {
				sql.exec("UPDATE poll SET closed_at = ? WHERE closed_at IS NULL", now);
				storage.kv.put(VERSION_KEY, version() + 1);
			});
		},

		markSummaryExported(now: number): void {
			sql.exec("UPDATE poll SET summary_exported_at = ?", now);
		},

		snapshot(poll: Poll, { now, viewers }: RoomContext, viewer: SnapshotViewer): PollSnapshot {
			return pollSnapshot({
				poll,
				countsByOptionId: countsByOptionId(),
				version: version(),
				now,
				viewers,
				...viewer,
			});
		},
	};
}
