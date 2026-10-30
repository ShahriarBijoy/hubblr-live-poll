import { AdminToken, PollId } from "@poll-request/domain";
import type { PollDraft } from "@poll-request/ui/poll/poll-composer";
import { describe, expect, it } from "vitest";
import {
	initialSubmission,
	newCredentials,
	parseDraft,
	resultForResponse,
	reusableCredentials,
	submissionReducer,
	validateDraft,
} from "./create-poll.form";

const filled: PollDraft = { question: "Tabs or spaces?", options: ["Tabs", "Spaces"], tone: "flame", durationMinutes: 60 };

function validDraft(draft: PollDraft) {
	const parsed = parseDraft(draft);
	if (parsed.kind !== "valid") throw new Error("expected a valid draft");
	return parsed.draft;
}

describe("create poll form", () => {
	it("checks the draft with the domain rules and names each problem at its field", () => {
		expect(validateDraft(filled)).toEqual({ options: {} });
		expect(validateDraft({ ...filled, question: "  ", options: ["Tabs", "tabs"] })).toEqual({
			question: "Write a question of 1 to 200 characters.",
			options: { 1: "Each option must be different." },
		});
		expect(validateDraft({ ...filled, options: ["Tabs", "o".repeat(81)] })).toEqual({
			options: { 1: "Write an option of 1 to 80 characters." },
		});
	});

	it("turns the duration in minutes into seconds and refuses one over 24 hours", () => {
		expect(validDraft(filled).durationSec).toBe(3600);
		expect(validDraft({ ...filled, durationMinutes: 1 }).durationSec).toBe(60);
		expect(validDraft({ ...filled, durationMinutes: 1440 }).durationSec).toBe(86400);
		expect(validateDraft({ ...filled, durationMinutes: 1441 })).toMatchObject({
			window: "Pick a duration from 1 minute to 24 hours.",
		});
	});

	it("sends the tone the creator picked", () => {
		expect(validDraft({ ...filled, tone: "truffle" }).tone).toBe("truffle");
	});

	it("reuses the ID and token for a retry of the same payload, and makes new ones after an edit", () => {
		const request = { ...validDraft(filled), ...newCredentials() };
		const failed = [
			{ type: "send-started", request } as const,
			{ type: "send-failed", ...resultForFailure(503) } as const,
		].reduce(submissionReducer, initialSubmission);

		expect(reusableCredentials(failed.lastSent, validDraft(filled))).toEqual({
			id: request.id,
			adminToken: request.adminToken,
		});
		expect(reusableCredentials(failed.lastSent, validDraft({ ...filled, question: "Spaces or tabs?" }))).toBeNull();
		expect(reusableCredentials(failed.lastSent, validDraft({ ...filled, tone: "oatmeal" }))).toBeNull();
	});

	it("makes new credentials after a 409, so the next submit does not hit the same conflict", () => {
		const request = { ...validDraft(filled), ...newCredentials() };
		const conflicted = [
			{ type: "send-started", request } as const,
			{ type: "send-failed", ...resultForFailure(409) } as const,
		].reduce(submissionReducer, initialSubmission);

		expect(reusableCredentials(conflicted.lastSent, request)).toBeNull();
	});

	it("names the field of a server 400 and shows the 413 and 429 text", () => {
		expect(resultForResponse(400, "invalid_durationSec")).toMatchObject({
			problem: "Pick a duration from 1 minute to 24 hours.",
		});
		expect(resultForResponse(413, null)).toMatchObject({ problem: "The poll is too large to send. Shorten the text." });
		expect(resultForResponse(429, null)).toMatchObject({
			problem: "Too many requests. Try again in a few seconds.",
		});
	});

	it("makes a poll ID and an admin token in the formats the server accepts", () => {
		const first = newCredentials();
		const second = newCredentials();

		expect(PollId.safeParse(first.id).success).toBe(true);
		expect(AdminToken.safeParse(first.adminToken).success).toBe(true);
		expect(second.id).not.toBe(first.id);
		expect(second.adminToken).not.toBe(first.adminToken);
	});
});

function resultForFailure(status: number) {
	const result = resultForResponse(status, null);
	if (result.kind !== "failed") throw new Error(`expected ${status} to fail`);
	return { problem: result.problem, newCredentialsNeeded: result.newCredentialsNeeded };
}
