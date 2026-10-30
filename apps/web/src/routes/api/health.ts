import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export type HealthResponse = { ok: true; sqliteTables: number };

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				const { sqliteTables } = await env.POLL_ROOM.getByName("health").ping();
				return Response.json({ ok: true, sqliteTables } satisfies HealthResponse);
			},
		},
	},
});
