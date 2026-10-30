import { CreatePollCommand, createPoll, pollSnapshot, type PollSnapshot } from "@poll-request/domain";
import { describe, expect, it } from "vitest";
import { closeFailureMessage, manageLinks, mergeManageSnapshot } from "./close-poll.manage";

const TOKEN = "A".repeat(43);
const NOW = 1_793_000_000_000;
const poll = createPoll(
	CreatePollCommand.parse({ id: "AbCdEfGhIj", question: "Tabs?", options: ["Yes", "No"], durationSec: 300, tone: "flame" }),
	NOW,
);

function snapshot(version: number, viewers = 0): PollSnapshot {
	return pollSnapshot({
		poll,
		countsByOptionId: { 1: version },
		version,
		now: NOW,
		viewers,
		resultsVisible: true,
		myOptionId: null,
	});
}

describe("manageLinks", () => {
	it("gives the two links and the Authorization header value from a full manage link", () => {
		expect(manageLinks(`https://poll.test/pr/AbCdEfGhIj/manage#${TOKEN}`, "AbCdEfGhIj")).toEqual({
			publicUrl: "https://poll.test/pr/AbCdEfGhIj",
			manageUrl: `https://poll.test/pr/AbCdEfGhIj/manage#${TOKEN}`,
			authorization: `Bearer ${TOKEN}`,
		});
	});

	it.each([
		["no fragment", "https://poll.test/pr/AbCdEfGhIj/manage", "AbCdEfGhIj"],
		["a cut-off token", `https://poll.test/pr/AbCdEfGhIj/manage#${TOKEN.slice(1)}`, "AbCdEfGhIj"],
		["a malformed poll ID", `https://poll.test/pr/x/manage#${TOKEN}`, "x"],
	])("is null for %s", (_case, href, pollId) => {
		expect(manageLinks(href, pollId)).toBeNull();
	});
});

describe("mergeManageSnapshot", () => {
	it("takes the first snapshot, a newer one, and one with the same version", () => {
		expect(mergeManageSnapshot(undefined, snapshot(1))).toEqual(snapshot(1));
		expect(mergeManageSnapshot(snapshot(1), snapshot(2))).toEqual(snapshot(2));
		expect(mergeManageSnapshot(snapshot(2), snapshot(2, 3))).toEqual(snapshot(2, 3));
	});

	it("keeps the cached snapshot when an older one arrives, and keeps a poll that is gone", () => {
		expect(mergeManageSnapshot(snapshot(2), snapshot(1))).toEqual(snapshot(2));
		expect(mergeManageSnapshot(null, snapshot(3))).toBeNull();
	});
});

describe("closeFailureMessage", () => {
	it.each([
		[401, "This manage link is incomplete."],
		[403, "This manage link does not belong to this poll."],
		[404, "This poll does not exist."],
		[429, "Too many requests."],
		[500, "The close did not reach the server."],
		[null, "The close did not reach the server."],
	])("tells the creator what to do after a %s", (status, text) => {
		expect(closeFailureMessage(status)).toContain(text);
	});
});
