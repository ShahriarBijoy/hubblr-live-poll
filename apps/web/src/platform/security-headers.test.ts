import { describe, expect, it } from "vitest";
import { createNonce, securityHeaders, withSecurityHeaders } from "./security-headers";

const DESIGN_TABLE_FOR_NONCE_ABC = {
	"Content-Security-Policy":
		"default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	"Cross-Origin-Opener-Policy": "same-origin",
};

describe("securityHeaders", () => {
	it("matches the design table, with the nonce in script-src", () => {
		expect(securityHeaders("abc")).toEqual(DESIGN_TABLE_FOR_NONCE_ABC);
	});
});

describe("createNonce", () => {
	it("returns a fresh base64 value of 128 bits each call", () => {
		const first = createNonce();
		expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		expect(createNonce()).not.toBe(first);
	});
});

describe("withSecurityHeaders", () => {
	it("adds every header to an HTML response and keeps status and body", async () => {
		const html = new Response("<p>hi</p>", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
		const secured = withSecurityHeaders(html, "abc");
		expect(secured.status).toBe(404);
		expect(await secured.text()).toBe("<p>hi</p>");
		for (const [name, value] of Object.entries(DESIGN_TABLE_FOR_NONCE_ABC)) {
			expect(secured.headers.get(name)).toBe(value);
		}
	});

	it("leaves a non-HTML response unchanged", () => {
		const json = Response.json({ ok: true });
		expect(withSecurityHeaders(json, "abc").headers.get("Content-Security-Policy")).toBeNull();
	});
});
