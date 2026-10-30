import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getGlobalStartContext } from "@tanstack/react-start";
import { PollPageSkeleton } from "@poll-request/ui/poll/poll-skeleton";
import { routeTree } from "./routeTree.gen";

type RequestContext = { nonce: string };

export function getRouter() {
	// One QueryClient per router, and the server makes one router per request, so one voter's choice can never reach
	// another voter's render.
	const queryClient = new QueryClient();
	const router = createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		// A page whose loader takes longer than 150 ms shows the skeleton, and keeps it for at least 300 ms, so a fast
		// load never flashes it and a slow one never flickers.
		defaultPendingComponent: PollPageSkeleton,
		defaultPendingMs: 150,
		defaultPendingMinMs: 300,
		ssr: { nonce: getGlobalStartContext()?.nonce },
	});
	// Dehydrates the cache into the HTML on the server, hydrates it in the browser, and provides the QueryClient.
	setupRouterSsrQueryIntegration({ router, queryClient });
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
		server: { requestContext: RequestContext };
	}
}
