import { CreatePollCommand } from "@poll-request/domain";
import type { z } from "zod";

// What the form checks before it has an ID and a token. The server checks the full CreatePollRequest.
export const CreatePollDraft = CreatePollCommand.omit({ id: true });
export type CreatePollDraft = z.infer<typeof CreatePollDraft>;

export const FIELD_PROBLEMS = {
	id: "The poll ID is malformed. Reload the page and try again.",
	question: "Write a question of 1 to 200 characters.",
	options: "Give 2 to 5 different options of 1 to 80 characters each.",
	durationSec: "Pick a duration from 1 minute to 24 hours.",
	tone: "Pick one of the four card colors.",
	adminToken: "The admin token is malformed. Reload the page and try again.",
} as const;

export type CreatePollField = keyof typeof FIELD_PROBLEMS;

export function fieldOfPath(path: readonly PropertyKey[]): CreatePollField | null {
	const [head] = path;
	return typeof head === "string" && Object.hasOwn(FIELD_PROBLEMS, head) ? (head as CreatePollField) : null;
}

const CREATE_POLL_FIELDS = Object.keys(FIELD_PROBLEMS) as CreatePollField[];

// A 400 body names the field in its code, so a client can put the problem next to that field.
export function invalidFieldCode(field: CreatePollField): `invalid_${CreatePollField}` {
	return `invalid_${field}`;
}

export function fieldOfInvalidCode(code: string): CreatePollField | null {
	return CREATE_POLL_FIELDS.find((field) => invalidFieldCode(field) === code) ?? null;
}
