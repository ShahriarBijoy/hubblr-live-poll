import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { createNonce, withSecurityHeaders } from "./platform/security-headers";
import { routeLiveSocket } from "./slices/live-results/live-results.handler";

export { PollRoom } from "./poll-room/poll-room";

// TanStack Start cannot answer a WebSocket upgrade, so the Worker routes it before the framework sees it.
const LIVE_PATH = /^\/api\/polls\/([^/]+)\/live$/;

export default createServerEntry({
	async fetch(request, opts) {
		const live = LIVE_PATH.exec(new URL(request.url).pathname);
		if (live !== null) return routeLiveSocket(request, live[1] ?? "", { env });
		const nonce = createNonce();
		const response = await handler.fetch(request, { ...opts, context: { nonce } });
		return withSecurityHeaders(response, nonce);
	},
});
