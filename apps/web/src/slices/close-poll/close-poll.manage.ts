import { AdminToken, PollId, type PollSnapshot } from "@poll-request/domain";
import { queryOptions } from "@tanstack/react-query";
import { RATE_LIMITED_MESSAGE } from "../../platform/rate-limit";

// Section 16 text. Other slices have the same constant, and slices cannot import each other.
const POLL_NOT_FOUND_MESSAGE = "This poll does not exist. Create a new one?";

// `authorization` is the Authorization header value. The token stays in memory and in the fragment only.
export type ManageLinks = { publicUrl: string; manageUrl: string; authorization: string };

export function manageLinks(href: string, pollIdParam: string): ManageLinks | null {
	const url = new URL(href);
	const pollId = PollId.safeParse(pollIdParam);
	const token = AdminToken.safeParse(url.hash.slice(1));
	if (!pollId.success || !token.success) return null;
	return {
		publicUrl: `${url.origin}/pr/${pollId.data}`,
		manageUrl: `${url.origin}/pr/${pollId.data}/manage#${token.data}`,
		authorization: `Bearer ${token.data}`,
	};
}

// null is a poll that is gone.
export type ManageData = PollSnapshot | null;

// Client only: the token never reaches the server render.
export function manageQuery(pollId: string, authorization: string) {
	return queryOptions({
		queryKey: ["poll", pollId, "manage"] as const,
		queryFn: async (): Promise<ManageData> => {
			const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, {
				headers: { Authorization: authorization },
			});
			if (response.status === 404) return null;
			if (!response.ok) throw new Error(`The server answered ${response.status}.`);
			return response.json<PollSnapshot>();
		},
	});
}

// Broadcasts can arrive out of order, so an older version never replaces a newer one. An equal version still wins,
// because a viewer count change does not bump the version.
export function mergeManageSnapshot(current: ManageData | undefined, incoming: PollSnapshot): ManageData | undefined {
	if (current === null) return current;
	if (current !== undefined && (incoming.results?.version ?? -1) < (current.results?.version ?? 0)) return current;
	return incoming;
}

const CLOSE_FAILURES: Partial<Record<number, string>> = {
	401: "This manage link is incomplete. Open the full link you saved, including the part after the #.",
	403: "This manage link does not belong to this poll. Open your own.",
	404: POLL_NOT_FOUND_MESSAGE,
	429: RATE_LIMITED_MESSAGE,
};

export function closeFailureMessage(status: number | null): string {
	return (
		(status === null ? undefined : CLOSE_FAILURES[status]) ??
		"The close did not reach the server. Check your connection and try again."
	);
}

export async function sendClose(pollId: string, authorization: string): Promise<PollSnapshot> {
	const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}/close`, {
		method: "POST",
		headers: { Authorization: authorization },
	}).catch((error: unknown) => {
		throw new Error(closeFailureMessage(null), { cause: error });
	});
	if (!response.ok) throw new Error(closeFailureMessage(response.status));
	return response.json<PollSnapshot>();
}
