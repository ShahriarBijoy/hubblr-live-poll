import { AdminToken } from "@poll-request/domain";
import { toBase64Url } from "./base64url";

// Workers adds timingSafeEqual to SubtleCrypto. The DOM lib's SubtleCrypto type, which this project also loads, lacks it.
declare global {
	interface SubtleCrypto {
		timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
	}
}

// A distinct type so the compiler rejects a raw AdminToken anywhere a stored hash is expected.
export type AdminTokenHash = string & { readonly __brand: "AdminTokenHash" };

export async function hashAdminToken(token: AdminToken): Promise<AdminTokenHash> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return toBase64Url(new Uint8Array(digest)) as AdminTokenHash;
}

// The token of `Authorization: Bearer <adminToken>`, or null when the header is missing or malformed.
export function adminTokenOf(request: Request): AdminToken | null {
	const match = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "");
	const token = AdminToken.safeParse(match?.[1]);
	return token.success ? token.data : null;
}

// The hash of the request's admin token, or null when it sent none.
export async function adminTokenHashOf(request: Request): Promise<AdminTokenHash | null> {
	const token = adminTokenOf(request);
	return token === null ? null : hashAdminToken(token);
}

// Constant time, so the response time does not tell how much of a guessed hash matches. Both hashes are SHA-256 in
// base64url and have the same length; a different length still runs a comparison, as the Cloudflare example does.
export function isAdminTokenHash(stored: AdminTokenHash, given: AdminTokenHash | null): boolean {
	if (given === null) return false;
	const encoder = new TextEncoder();
	const [a, b] = [encoder.encode(stored), encoder.encode(given)];
	return a.byteLength === b.byteLength ? crypto.subtle.timingSafeEqual(a, b) : !crypto.subtle.timingSafeEqual(b, b);
}
