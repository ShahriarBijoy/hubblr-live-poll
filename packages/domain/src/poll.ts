import "./zod-config";
import { z } from "zod";
import { DurationSec } from "./review-window";

export const PollId = z.string().regex(/^[A-Za-z0-9_-]{10}$/).brand<"PollId">();
export type PollId = z.infer<typeof PollId>;

export const AdminToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/).brand<"AdminToken">();
export type AdminToken = z.infer<typeof AdminToken>;

export const OptionId = z.int().positive().brand<"OptionId">();
export type OptionId = z.infer<typeof OptionId>;

// 16 random bytes in base64url. The schema checks the format only: a VoterId is trustworthy only when it came out of
// a verified voter cookie.
export const VoterId = z.string().regex(/^[A-Za-z0-9_-]{22}$/).brand<"VoterId">();
export type VoterId = z.infer<typeof VoterId>;

export const QUESTION_MAX_LENGTH = 200;
export const OPTION_LABEL_MAX_LENGTH = 80;

export const Question = z.string().trim().min(1).max(QUESTION_MAX_LENGTH);

export const OptionLabel = z.string().trim().min(1).max(OPTION_LABEL_MAX_LENGTH);

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;

export const OptionLabels = z
	.array(OptionLabel)
	.min(MIN_OPTIONS)
	.max(MAX_OPTIONS)
	.superRefine((labels, ctx) => {
		const seen = new Set<string>();
		labels.forEach((label, index) => {
			// toLowerCase, not toLocaleLowerCase, so the server and every browser agree on what a duplicate is.
			const key = label.toLowerCase();
			if (seen.has(key)) {
				ctx.addIssue({ code: "custom", message: "Each option must be different.", path: [index] });
			}
			seen.add(key);
		});
	});

// The creator's card color. The UI maps each tone to its palette.
export const TONES = ["flame", "truffle", "oatmeal", "palladian"] as const;
export const Tone = z.enum(TONES);
export type Tone = z.infer<typeof Tone>;

// The tone of a poll stored before tones existed. Stable, so the poll keeps its color on every load.
export function toneFromId(id: string): Tone {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return TONES[hash % TONES.length] ?? "flame";
}

export type PollOption = {
	id: OptionId;
	label: string;
	position: number;
};

export type Poll = {
	id: PollId;
	question: string;
	options: PollOption[];
	tone: Tone;
	createdAt: number;
	closesAt: number;
	closedAt: number | null;
};

export const CreatePollCommand = z.object({
	id: PollId,
	question: Question,
	options: OptionLabels,
	durationSec: DurationSec,
	tone: Tone,
});
export type CreatePollCommand = z.infer<typeof CreatePollCommand>;

// The REST body. The token stays out of CreatePollCommand so the raw secret stops at the handler, which hashes it.
export const CreatePollRequest = CreatePollCommand.extend({ adminToken: AdminToken });
export type CreatePollRequest = z.infer<typeof CreatePollRequest>;

export function createPoll(command: CreatePollCommand, now: number): Poll {
	return {
		id: command.id,
		question: command.question,
		options: command.options.map((label, position) => ({ id: (position + 1) as OptionId, label, position })),
		tone: command.tone,
		createdAt: now,
		closesAt: now + command.durationSec * 1000,
		closedAt: null,
	};
}

export function pollDurationSec(poll: Poll): number {
	return (poll.closesAt - poll.createdAt) / 1000;
}

export type CreateDecision = { kind: "create" } | { kind: "replay"; poll: Poll } | { kind: "conflict" };

export function decideCreate(
	existing: { poll: Poll; adminTokenHash: string } | null,
	command: CreatePollCommand,
	adminTokenHash: string,
): CreateDecision {
	if (existing === null) return { kind: "create" };
	const { poll } = existing;
	const isSameRequest =
		existing.adminTokenHash === adminTokenHash &&
		poll.question === command.question &&
		pollDurationSec(poll) === command.durationSec &&
		poll.tone === command.tone &&
		poll.options.length === command.options.length &&
		poll.options.every((option) => option.label === command.options[option.position]);
	return isSameRequest ? { kind: "replay", poll } : { kind: "conflict" };
}
