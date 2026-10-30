import { errorResponse } from "./http";

export const RATE_LIMITED_MESSAGE = "Too many requests. Try again in a few seconds.";

// Cloudflare sets cf-connecting-ip on every request at the edge. Requests without it share one bucket.
export function clientIp(request: Request): string {
	return request.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function isRateLimited(limiter: RateLimit, key: string): Promise<boolean> {
	const { success } = await limiter.limit({ key });
	return !success;
}

export function rateLimitedResponse(): Response {
	return errorResponse(429, "rate_limited", RATE_LIMITED_MESSAGE);
}
