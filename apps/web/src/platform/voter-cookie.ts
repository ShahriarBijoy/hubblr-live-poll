import { VoterId } from "@poll-request/domain";
import { toBase64Url } from "./base64url";
import { signValue, verifySignedValue } from "./signed-value";

const VOTER_COOKIE = "pr_voter";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

// The voter of a request with a valid voter cookie, or null. A missing, tampered, or foreign cookie is null.
export async function voterIdOf(request: Request, secret: string | undefined): Promise<VoterId | null> {
	const signed = cookieValue(request.headers.get("Cookie"), VOTER_COOKIE);
	if (signed === undefined) return null;
	const parsed = VoterId.safeParse(await verifySignedValue(secret, "voter", signed));
	return parsed.success ? parsed.data : null;
}

// The voter of the request, or a new voter with the Set-Cookie header value that makes the browser keep it.
export async function ensureVoter(
	request: Request,
	secret: string | undefined,
): Promise<{ voterId: VoterId; setCookie: string | null }> {
	const existing = await voterIdOf(request, secret);
	if (existing !== null) return { voterId: existing, setCookie: null };
	const voterId = VoterId.parse(toBase64Url(crypto.getRandomValues(new Uint8Array(16))));
	const signed = await signValue(secret, "voter", voterId);
	return {
		voterId,
		setCookie: `${VOTER_COOKIE}=${signed}; Max-Age=${MAX_AGE_SEC}; Path=/; HttpOnly; Secure; SameSite=Lax`,
	};
}

function cookieValue(header: string | null, name: string): string | undefined {
	for (const pair of header?.split(";") ?? []) {
		const separator = pair.indexOf("=");
		if (separator !== -1 && pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
	}
	return undefined;
}
