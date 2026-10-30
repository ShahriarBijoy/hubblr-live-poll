import { fromBase64Url, toBase64Url } from "./base64url";

export const MIN_SECRET_LENGTH = 32;

// The purpose is part of the MAC input, so a value signed for one purpose never verifies for another, also when both
// use the same secret.
export type SignedPurpose = "voter" | "live-ticket";

// `${value}.${base64url(HMAC-SHA256(secret, purpose + "\n" + value))}`
export async function signValue(secret: string | undefined, purpose: SignedPurpose, value: string): Promise<string> {
	const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret), macInput(purpose, value));
	return `${value}.${toBase64Url(new Uint8Array(mac))}`;
}

// The value, or null when the signature is missing, malformed, or wrong. Throws only for a bad secret, never for the
// signed text, which comes from the request.
export async function verifySignedValue(
	secret: string | undefined,
	purpose: SignedPurpose,
	signed: string,
): Promise<string | null> {
	const key = await hmacKey(secret);
	const dot = signed.lastIndexOf(".");
	if (dot === -1) return null;
	const value = signed.slice(0, dot);
	const mac = fromBase64Url(signed.slice(dot + 1));
	if (mac === null) return null;
	return (await crypto.subtle.verify("HMAC", key, mac, macInput(purpose, value))) ? value : null;
}

function macInput(purpose: SignedPurpose, value: string): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(`${purpose}\n${value}`);
}

// wrangler refuses to deploy without the secret (secrets.required), so this guards local runs and tests.
async function hmacKey(secret: string | undefined): Promise<CryptoKey> {
	if (secret === undefined || secret.length < MIN_SECRET_LENGTH) {
		console.error(
			`VOTER_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
				"Run `pnpm dev` once to create apps/web/.dev.vars, or set the secret with `wrangler secret put VOTER_SECRET`.",
		);
		throw new Error("VOTER_SECRET is missing or too short.");
	}
	const raw = new TextEncoder().encode(secret);
	return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
