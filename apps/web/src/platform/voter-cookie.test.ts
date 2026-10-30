import { VoterId } from "@poll-request/domain";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { ensureVoter, voterIdOf } from "./voter-cookie";

function requestWithCookie(cookie?: string): Request {
	return new Request("https://poll.test/pr/AbCdEfGhIj", cookie === undefined ? {} : { headers: { Cookie: cookie } });
}

async function mintedCookie(): Promise<{ voterId: VoterId; cookie: string }> {
	const { voterId, setCookie } = await ensureVoter(requestWithCookie(), env.VOTER_SECRET);
	if (setCookie === null) throw new Error("expected a new voter cookie");
	return { voterId, cookie: setCookie.split(";")[0] ?? "" };
}

describe("voter cookie", () => {
	it("mints a new voter with an HttpOnly, Secure, Lax cookie for 30 days when the request has none", async () => {
		const { voterId, setCookie } = await ensureVoter(requestWithCookie(), env.VOTER_SECRET);
		const [pair, ...attributes] = (setCookie ?? "").split("; ");

		expect(VoterId.safeParse(voterId).success).toBe(true);
		expect(pair).toMatch(new RegExp(`^pr_voter=${voterId}\\.[A-Za-z0-9_-]{43}$`));
		expect(attributes.sort()).toEqual(["HttpOnly", "Max-Age=2592000", "Path=/", "SameSite=Lax", "Secure"]);
	});

	it("keeps the voter of a valid cookie and sends no new cookie", async () => {
		const { voterId, cookie } = await mintedCookie();
		const request = requestWithCookie(`theme=dark; ${cookie}; other=1`);

		expect(await ensureVoter(request, env.VOTER_SECRET)).toEqual({ voterId, setCookie: null });
		expect(await voterIdOf(request, env.VOTER_SECRET)).toBe(voterId);
	});

	it("reads no voter from a missing, tampered, or foreign cookie, and mints a new one for it", async () => {
		const { voterId, cookie } = await mintedCookie();
		const other = await mintedCookie();
		const forged = `${cookie.slice(0, cookie.lastIndexOf("."))}${other.cookie.slice(other.cookie.lastIndexOf("."))}`;
		const foreign = await ensureVoter(requestWithCookie(), "f".repeat(32));

		for (const header of [undefined, "pr_voter=", forged, foreign.setCookie?.split(";")[0]]) {
			const request = requestWithCookie(header);
			expect(await voterIdOf(request, env.VOTER_SECRET)).toBeNull();
			const minted = await ensureVoter(request, env.VOTER_SECRET);
			expect(minted.setCookie).not.toBeNull();
			expect(minted.voterId).not.toBe(voterId);
		}
	});
});
