import { describe, expect, it } from "vitest";
import { CreatePollCommand, CreatePollRequest, TONES, createPoll, decideCreate, toneFromId } from "./index";

const NOW = 1_700_000_000_000;

const validRequest = {
	id: "abcDEF_-12",
	question: "Tabs or spaces?",
	options: ["Tabs", "Spaces", "Both, chaotically"],
	durationSec: 3600,
	tone: "flame",
	adminToken: "A".repeat(42) + "_",
};

describe("CreatePollRequest", () => {
	it("accepts a valid body and trims the text", () => {
		const parsed = CreatePollRequest.parse({
			...validRequest,
			question: "  Tabs or spaces?  ",
			options: [" Tabs ", "Spaces"],
		});
		expect(parsed.question).toBe("Tabs or spaces?");
		expect(parsed.options).toEqual(["Tabs", "Spaces"]);
	});

	it.each([
		["one option", { options: ["Tabs"] }],
		["six options", { options: ["a", "b", "c", "d", "e", "f"] }],
		["a blank question", { question: "   " }],
		["a 201-character question", { question: "q".repeat(201) }],
		["a blank option", { options: ["Tabs", "  "] }],
		["an 81-character option", { options: ["Tabs", "o".repeat(81)] }],
		["a durationSec longer than 24 hours", { durationSec: 90000 }],
		["no tone", { tone: undefined }],
		["a tone outside the palette", { tone: "neon" }],
		["an id that is too short", { id: "abc123" }],
		["an id with a character outside base64url", { id: "abcdefghi!" }],
		["a token that is too short", { adminToken: "A".repeat(42) }],
		["a token with base64 padding", { adminToken: "A".repeat(42) + "=" }],
	])("rejects %s", (_, override) => {
		expect(CreatePollRequest.safeParse({ ...validRequest, ...override }).success).toBe(false);
	});

	it("rejects labels that are equal ignoring case and reports the later one", () => {
		const result = CreatePollRequest.safeParse({ ...validRequest, options: ["Tabs", "Spaces", " tABS "] });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([["options", 2]]);
	});
});

describe("createPoll", () => {
	it("numbers the options 1..n in order and closes after the review window", () => {
		const command = CreatePollCommand.parse({ ...validRequest, durationSec: 300 });
		expect(createPoll(command, NOW)).toEqual({
			id: "abcDEF_-12",
			question: "Tabs or spaces?",
			options: [
				{ id: 1, label: "Tabs", position: 0 },
				{ id: 2, label: "Spaces", position: 1 },
				{ id: 3, label: "Both, chaotically", position: 2 },
			],
			tone: "flame",
			createdAt: NOW,
			closesAt: NOW + 300_000,
			closedAt: null,
		});
	});

	it("closes a 24-hour poll exactly 24 hours later", () => {
		const command = CreatePollCommand.parse({ ...validRequest, durationSec: 86400 });
		expect(createPoll(command, NOW).closesAt).toBe(NOW + 24 * 60 * 60 * 1000);
	});
});

describe("decideCreate", () => {
	const command = CreatePollCommand.parse(validRequest);
	const stored = { poll: createPoll(command, NOW), adminTokenHash: "hash-a" };

	it("creates when no poll has the id", () => {
		expect(decideCreate(null, command, "hash-a")).toEqual({ kind: "create" });
	});

	it("replays the stored poll for the same body and token hash", () => {
		const decision = decideCreate(stored, command, "hash-a");
		expect(decision).toEqual({ kind: "replay", poll: stored.poll });
	});

	it.each([
		["a different question", { question: "Vim or Emacs?" }],
		["the same options in a different order", { options: ["Spaces", "Tabs", "Both, chaotically"] }],
		["a different option label", { options: ["Tabs", "Spaces", "Neither"] }],
		["one option fewer", { options: ["Tabs", "Spaces"] }],
		["a different review window", { durationSec: 86400 }],
		["a different tone", { tone: "truffle" }],
	])("conflicts on %s", (_, override) => {
		const other = CreatePollCommand.parse({ ...validRequest, ...override });
		expect(decideCreate(stored, other, "hash-a")).toEqual({ kind: "conflict" });
	});

	it("conflicts on the same body with a different token hash", () => {
		expect(decideCreate(stored, command, "hash-b")).toEqual({ kind: "conflict" });
	});
});

describe("toneFromId", () => {
	it("gives a poll without a stored tone the same palette tone on every load", () => {
		const tone = toneFromId("abcDEF_-12");
		expect(TONES).toContain(tone);
		expect(toneFromId("abcDEF_-12")).toBe(tone);
	});
});
