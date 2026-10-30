const STATIC_SECURITY_HEADERS = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	"Cross-Origin-Opener-Policy": "same-origin",
} as const;

export type SecurityHeaderName = "Content-Security-Policy" | keyof typeof STATIC_SECURITY_HEADERS;

export type SecurityHeaders = Readonly<Record<SecurityHeaderName, string>>;

export function securityHeaders(nonce: string): SecurityHeaders {
	return {
		"Content-Security-Policy": [
			"default-src 'self'",
			`script-src 'self' 'nonce-${nonce}'`,
			"style-src 'self' 'unsafe-inline'",
			"connect-src 'self'",
			"frame-ancestors 'none'",
			"base-uri 'none'",
			"form-action 'self'",
		].join("; "),
		...STATIC_SECURITY_HEADERS,
	};
}

export function createNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes));
}

export function withSecurityHeaders(response: Response, nonce: string): Response {
	if (!response.headers.get("Content-Type")?.startsWith("text/html")) return response;
	const secured = new Response(response.body, response);
	for (const [name, value] of Object.entries(securityHeaders(nonce))) secured.headers.set(name, value);
	return secured;
}
