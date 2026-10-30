import type { CreatePollRequest } from "@poll-request/domain";
import type { PollDraft } from "@poll-request/ui/poll/poll-composer";
import { CreatePollView as CreatePollScreen } from "@poll-request/ui/poll/views/create-poll-view";
import { useNavigate } from "@tanstack/react-router";
import { useReducer } from "react";
import {
	CREATE_DESCRIPTION,
	CREATE_LIMITS,
	CREATE_TITLE,
	OPTION_LIMIT_MESSAGE,
	initialSubmission,
	newCredentials,
	parseDraft,
	reusableCredentials,
	sendCreatePoll,
	submissionReducer,
	validateDraft,
} from "./create-poll.form";

export function CreatePollView() {
	const [submission, dispatch] = useReducer(submissionReducer, initialSubmission);
	const navigate = useNavigate();

	// The composer calls this only when validateDraft found nothing, so the parse here always succeeds.
	async function create(pollDraft: PollDraft) {
		const parsed = parseDraft(pollDraft);
		if (submission.sending || parsed.kind === "invalid") return;
		const request: CreatePollRequest = {
			...parsed.draft,
			...(reusableCredentials(submission.lastSent, parsed.draft) ?? newCredentials()),
		};
		dispatch({ type: "send-started", request });
		const result = await sendCreatePoll(request);
		if (result.kind === "opened") {
			await navigate({ to: "/pr/$pollId/manage", params: { pollId: request.id }, hash: request.adminToken });
			return;
		}
		dispatch({ type: "send-failed", problem: result.problem, newCredentialsNeeded: result.newCredentialsNeeded });
	}

	return (
		<CreatePollScreen
			title={CREATE_TITLE}
			description={CREATE_DESCRIPTION}
			limits={CREATE_LIMITS}
			validate={validateDraft}
			onSubmit={create}
			pending={submission.sending}
			error={submission.problem}
			optionLimitText={OPTION_LIMIT_MESSAGE}
		/>
	);
}
