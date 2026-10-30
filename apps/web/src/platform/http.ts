export type ErrorBody = { code: string; message: string };

export function errorResponse(status: number, code: string, message: string): Response {
	return Response.json({ code, message } satisfies ErrorBody, { status });
}

// Every request body is 4 KB at most.
export const MAX_BODY_BYTES = 4096;

export type JsonBody = { kind: "json"; value: unknown } | { kind: "too-large" };

// Malformed JSON and a missing body both come back as undefined, so the request schema answers both with one 400.
export async function readJsonBody(request: Request): Promise<JsonBody> {
	const body = await readBodyText(request, MAX_BODY_BYTES);
	if (body.kind === "too-large") return body;
	try {
		return { kind: "json", value: JSON.parse(body.text) };
	} catch {
		return { kind: "json", value: undefined };
	}
}

type BodyText = { kind: "text"; text: string } | { kind: "too-large" };

// Counts bytes as they stream in, so a chunked body without Content-Length cannot get past the limit.
async function readBodyText(request: Request, maxBytes: number): Promise<BodyText> {
	if (Number(request.headers.get("Content-Length") ?? 0) > maxBytes) return { kind: "too-large" };
	if (request.body === null) return { kind: "text", text: "" };
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let text = "";
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return { kind: "text", text: text + decoder.decode() };
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return { kind: "too-large" };
		}
		text += decoder.decode(value, { stream: true });
	}
}
