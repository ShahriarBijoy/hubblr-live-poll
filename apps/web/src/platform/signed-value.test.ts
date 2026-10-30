import { describe, expect, it, vi } from "vitest";
import { signValue, verifySignedValue } from "./signed-value";

const SECRET = "s".repeat(32);
const OTHER_SECRET = "o".repeat(32);

describe("signed values", () => {
	it("verifies a value it signed, also when the value contains dots", async () => {
		for (const value of ["voter-1", "poll.1793000000000.voter"]) {
			expect(await verifySignedValue(SECRET, "voter", await signValue(SECRET, "voter", value))).toBe(value);
		}
	});

	it("refuses a changed value, a changed signature, another secret, and text that is not a signed value", async () => {
		const signed = await signValue(SECRET, "voter", "voter-1");
		const [value, mac] = [signed.slice(0, signed.lastIndexOf(".")), signed.slice(signed.lastIndexOf(".") + 1)];
		const flipped = `${mac[0] === "A" ? "B" : "A"}${mac.slice(1)}`;

		for (const candidate of [`voter-2.${mac}`, `${value}.${flipped}`, `${value}.${mac}!`, `${value}.`, "voter-1", ""]) {
			expect(await verifySignedValue(SECRET, "voter", candidate)).toBeNull();
		}
		expect(await verifySignedValue(OTHER_SECRET, "voter", signed)).toBeNull();
	});

	it.each([undefined, "short"])("logs and throws when the secret is %j", async (secret) => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(signValue(secret, "voter", "voter-1")).rejects.toThrow("VOTER_SECRET");
		expect(logged).toHaveBeenCalledOnce();
		expect(String(logged.mock.calls[0]?.[0])).toContain("VOTER_SECRET");
		logged.mockRestore();
	});
});
