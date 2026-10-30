import { describe, expect, it } from "vitest";
import {
	CreatePollCommand,
	RETENTION_MS,
	alarmStep,
	createPoll,
	decideClose,
	pollStatus,
	statusAt,
	type PollStatus,
} from "./index";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

const poll = createPoll(
	CreatePollCommand.parse({ id: "abcDEF_-12", question: "Ship it?", options: ["Yes", "No"], durationSec: 3600, tone: "flame" }),
	NOW,
);

describe("pollStatus", () => {
	it("is open before closesAt", () => {
		expect(pollStatus(poll, NOW + HOUR - 1)).toEqual({ kind: "open", closesAt: NOW + HOUR });
	});

	it("is closed by the timer exactly at closesAt", () => {
		expect(pollStatus(poll, NOW + HOUR)).toEqual({ kind: "closed", closedAt: NOW + HOUR, closedBy: "timer" });
	});

	it("is closed by the timer after closesAt, with closedAt at closesAt", () => {
		expect(pollStatus(poll, NOW + 2 * HOUR)).toEqual({ kind: "closed", closedAt: NOW + HOUR, closedBy: "timer" });
	});

	it("is closed by the creator once closedAt is set, before and after closesAt", () => {
		const merged = { ...poll, closedAt: NOW + 60_000 };
		const expected = { kind: "closed", closedAt: NOW + 60_000, closedBy: "creator" };
		expect(pollStatus(merged, NOW + 61_000)).toEqual(expected);
		expect(pollStatus(merged, NOW + 2 * HOUR)).toEqual(expected);
	});
});

describe("statusAt", () => {
	const open: PollStatus = { kind: "open", closesAt: NOW + HOUR };

	it("keeps an open status open before closesAt", () => {
		expect(statusAt(open, NOW + HOUR - 1)).toEqual(open);
	});

	it("turns an open status into a timer close at closesAt", () => {
		expect(statusAt(open, NOW + HOUR)).toEqual({ kind: "closed", closedAt: NOW + HOUR, closedBy: "timer" });
	});

	it("leaves a creator close as it is", () => {
		const merged: PollStatus = { kind: "closed", closedAt: NOW + 60_000, closedBy: "creator" };
		expect(statusAt(merged, NOW + 2 * HOUR)).toEqual(merged);
	});
});

describe("alarmStep", () => {
	const closesAt = NOW + HOUR;
	const merged = { ...poll, closedAt: NOW + 60_000 };

	it.each([
		["an open poll waits for closesAt", poll, null, closesAt - 1, { kind: "wait", until: closesAt }],
		["a poll exports at closesAt", poll, null, closesAt, { kind: "export" }],
		["a poll the creator closed exports before closesAt", merged, null, NOW + 61_000, { kind: "export" }],
		[
			"an exported timer close waits seven days",
			poll,
			closesAt,
			closesAt,
			{ kind: "wait", until: closesAt + RETENTION_MS },
		],
		[
			"an exported creator close waits seven days from closedAt",
			merged,
			NOW + 61_000,
			NOW + 61_000,
			{ kind: "wait", until: NOW + 60_000 + RETENTION_MS },
		],
		[
			"an exported poll still waits 1 ms before the seven days",
			poll,
			closesAt,
			closesAt + RETENTION_MS - 1,
			{ kind: "wait", until: closesAt + RETENTION_MS },
		],
		["an exported poll deletes at seven days", poll, closesAt, closesAt + RETENTION_MS, { kind: "delete" }],
		["an unexported poll exports even after seven days", poll, null, closesAt + 2 * RETENTION_MS, { kind: "export" }],
	])("%s", (_case, state, summaryExportedAt, now, step) => {
		expect(alarmStep(state, summaryExportedAt, now)).toEqual(step);
	});
});

describe("decideClose", () => {
	it.each([
		["closes an open poll at now", poll, NOW + HOUR - 1, { kind: "close", closedAt: NOW + HOUR - 1 }],
		["leaves a poll alone at closesAt, as the timer closed it", poll, NOW + HOUR, { kind: "already-closed" }],
		[
			"leaves a poll the creator closed alone",
			{ ...poll, closedAt: NOW + 60_000 },
			NOW + 61_000,
			{ kind: "already-closed" },
		],
	])("%s", (_case, state, now, decision) => {
		expect(decideClose(state, now)).toEqual(decision);
	});
});
