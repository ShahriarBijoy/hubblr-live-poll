import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { voteViewKey } from "./cast-vote.form";
import { loadVoteView } from "./cast-vote.handler";

// One entry point for both paths. In the server render the loader calls it in process, so the cookie lands on the
// HTML response. In a client navigation it is a same-origin GET, so the cookie lands on that response.
const fetchVoteView = createServerFn({ method: "GET" })
	.validator(z.object({ pollId: z.string() }))
	.handler(async ({ data }) => {
		const { result, setCookie } = await loadVoteView(getRequest(), data.pollId, { env });
		if (setCookie !== null) appendResponseHeader("Set-Cookie", setCookie);
		// The answer holds this voter's choice, so no shared cache may keep it.
		setResponseHeader("Cache-Control", "no-store");
		return result;
	});

export function voteViewQuery(pollId: string) {
	return queryOptions({
		queryKey: voteViewKey(pollId),
		queryFn: () => fetchVoteView({ data: { pollId } }),
		// Hydration fills the cache with the server render's answer, so the client does not ask again right away.
		staleTime: 30_000,
	});
}

export async function loadVotePage(queryClient: QueryClient, pollId: string): Promise<{ question: string }> {
	const result = await queryClient.ensureQueryData(voteViewQuery(pollId));
	if (result.kind === "not-found") throw notFound();
	// A vote is final, so a voter who voted never sees the form again.
	if (result.snapshot.myOptionId !== null) throw redirect({ to: "/pr/$pollId/results", params: { pollId } });
	return { question: result.snapshot.question };
}
