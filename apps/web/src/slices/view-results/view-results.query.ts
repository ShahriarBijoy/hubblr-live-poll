import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { readResults } from "./view-results.handler";

const fetchResults = createServerFn({ method: "GET" })
	.validator(z.object({ pollId: z.string() }))
	.handler(async ({ data }) => {
		const result = await readResults(getRequest(), data.pollId, { env });
		// The answer holds this voter's choice, so no shared cache may keep it.
		setResponseHeader("Cache-Control", "no-store");
		return result;
	});

export function resultsQuery(pollId: string) {
	return queryOptions({
		queryKey: ["poll", pollId, "results"] as const,
		queryFn: () => fetchResults({ data: { pollId } }),
		staleTime: 30_000,
	});
}

export async function loadResultsPage(queryClient: QueryClient, pollId: string): Promise<{ question: string }> {
	// Always ask the server, so a navigation right after a vote never reuses an answer that hid the counts.
	const result = await queryClient.fetchQuery({ ...resultsQuery(pollId), staleTime: 0 });
	if (result.kind === "not-found") throw notFound();
	if (result.snapshot.results === null) throw redirect({ to: "/pr/$pollId", params: { pollId } });
	return { question: result.snapshot.question };
}
