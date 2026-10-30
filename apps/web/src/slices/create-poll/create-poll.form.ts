import {
	AdminToken,
	MAX_OPTIONS,
	MIN_OPTIONS,
	OPTION_LABEL_MAX_LENGTH,
	PollId,
	QUESTION_MAX_LENGTH,
	type CreatePollRequest,
} from "@poll-request/domain";
import type { PollDraft, PollDraftErrors, PollLimits } from "@poll-request/ui/poll/poll-composer";
import { z } from "zod";
import { toBase64Url } from "../../platform/base64url";
import { RATE_LIMITED_MESSAGE } from "../../platform/rate-limit";
import { CreatePollDraft, FIELD_PROBLEMS, fieldOfInvalidCode } from "./create-poll.schema";

export const CREATE_TITLE = "Create a poll";
export const CREATE_DESCRIPTION = "Ask a question, add 2 to 5 answers, and share the link. Results update live as people vote.";
export const OPTION_LIMIT_MESSAGE = "You can add up to 5 answers.";
const OPTION_ROW_PROBLEM = "Write an option of 1 to 80 characters.";
const ID_TAKEN_PROBLEM = "That poll ID is already taken. Submit again to get a new one.";
const TOO_LARGE_PROBLEM = "The poll is too large to send. Shorten the text.";
const SERVER_PROBLEM = "The server did not open the poll. Try again.";
const NETWORK_PROBLEM = "The request did not reach the server. Check your connection and try again.";

export const CREATE_LIMITS: PollLimits = {
	questionMax: QUESTION_MAX_LENGTH,
	optionMax: OPTION_LABEL_MAX_LENGTH,
	minOptions: MIN_OPTIONS,
	maxOptions: MAX_OPTIONS,
};

export type ParsedDraft = { kind: "valid"; draft: CreatePollDraft } | { kind: "invalid"; errors: PollDraftErrors };

// The composer's draft through the domain schema, so the form and the server share one rule set.
export function parseDraft(draft: PollDraft): ParsedDraft {
	const parsed = CreatePollDraft.safeParse({
		question: draft.question,
		options: draft.options,
		durationSec: draft.durationMinutes * 60,
		tone: draft.tone,
	});
	if (parsed.success) return { kind: "valid", draft: parsed.data };
	const errors: PollDraftErrors = { options: {} };
	for (const issue of parsed.error.issues) {
		const [field, row] = issue.path;
		if (field === "question") errors.question = FIELD_PROBLEMS.question;
		else if (field === "durationSec") errors.window = FIELD_PROBLEMS.durationSec;
		else if (field === "tone") errors.form = FIELD_PROBLEMS.tone;
		else if (field === "options" && typeof row === "number") {
			// The only custom issue on a row is the duplicate check, and its message already says what to fix.
			errors.options[row] ??= issue.code === "custom" ? issue.message : OPTION_ROW_PROBLEM;
		} else errors.form = FIELD_PROBLEMS.options;
	}
	return { kind: "invalid", errors };
}

export function validateDraft(draft: PollDraft): PollDraftErrors {
	const parsed = parseDraft(draft);
	return parsed.kind === "invalid" ? parsed.errors : { options: {} };
}

export type Submission = {
	sending: boolean;
	problem: string | null;
	// The last request on the wire. A retry of the same payload reuses its ID and token, so the server replays it.
	lastSent: CreatePollRequest | null;
};

export const initialSubmission: Submission = { sending: false, problem: null, lastSent: null };

export type SubmissionAction =
	| { type: "send-started"; request: CreatePollRequest }
	| { type: "send-failed"; problem: string; newCredentialsNeeded: boolean };

export function submissionReducer(state: Submission, action: SubmissionAction): Submission {
	switch (action.type) {
		case "send-started":
			return { sending: true, problem: null, lastSent: action.request };
		case "send-failed":
			return {
				sending: false,
				problem: action.problem,
				lastSent: action.newCredentialsNeeded ? null : state.lastSent,
			};
	}
}

export type Credentials = Pick<CreatePollRequest, "id" | "adminToken">;

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function newCredentials(): Credentials {
	const idBytes = crypto.getRandomValues(new Uint8Array(10));
	return {
		// 64 symbols divide 256 evenly, so masking each byte keeps all 60 bits uniform.
		id: PollId.parse(Array.from(idBytes, (byte) => ID_ALPHABET[byte & 63]).join("")),
		adminToken: AdminToken.parse(toBase64Url(crypto.getRandomValues(new Uint8Array(32)))),
	};
}

export function reusableCredentials(lastSent: CreatePollRequest | null, draft: CreatePollDraft): Credentials | null {
	if (lastSent === null) return null;
	const samePayload =
		lastSent.question === draft.question &&
		lastSent.durationSec === draft.durationSec &&
		lastSent.tone === draft.tone &&
		lastSent.options.length === draft.options.length &&
		lastSent.options.every((label, index) => label === draft.options[index]);
	return samePayload ? { id: lastSent.id, adminToken: lastSent.adminToken } : null;
}

export type SendFailure = { kind: "failed"; problem: string; newCredentialsNeeded: boolean };

export type SendResult = { kind: "opened" } | SendFailure;

const ErrorCode = z.object({ code: z.string() });

export async function sendCreatePoll(request: CreatePollRequest): Promise<SendResult> {
	let response: Response;
	try {
		response = await fetch("/api/polls", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
		});
	} catch {
		return failed(NETWORK_PROBLEM);
	}
	const code = response.status === 400 ? ErrorCode.safeParse(await response.json().catch(() => null)).data?.code : null;
	return resultForResponse(response.status, code ?? null);
}

export function resultForResponse(status: number, code: string | null): SendResult {
	if (status === 200 || status === 201) return { kind: "opened" };
	if (status === 400) {
		const field = code === null ? null : fieldOfInvalidCode(code);
		return failed(field === null ? SERVER_PROBLEM : FIELD_PROBLEMS[field]);
	}
	if (status === 409) return { ...failed(ID_TAKEN_PROBLEM), newCredentialsNeeded: true };
	if (status === 413) return failed(TOO_LARGE_PROBLEM);
	if (status === 429) return failed(RATE_LIMITED_MESSAGE);
	return failed(SERVER_PROBLEM);
}

function failed(problem: string): SendFailure {
	return { kind: "failed", problem, newCredentialsNeeded: false };
}
