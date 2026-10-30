CREATE TABLE poll_summary (
	poll_id      TEXT PRIMARY KEY,
	created_at   INTEGER NOT NULL,
	duration_sec INTEGER NOT NULL,
	closes_at    INTEGER NOT NULL,
	option_count INTEGER NOT NULL,
	closed_at    INTEGER,
	closed_by    TEXT CHECK (closed_by IN ('creator', 'timer')),
	total_votes  INTEGER,
	counts_json  TEXT
);
