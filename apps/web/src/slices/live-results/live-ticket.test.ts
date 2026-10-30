import { PollId } from "@poll-request/domain";
import { describe, expect, it } from "vitest";
import { signValue } from "../../platform/signed-value";
import { issueLiveTicket, verifyLiveTicket } from "./live-ticket";

const SECRET = "s".repeat(32);
const NOW = 1_793_000_000_000;
const POLL = PollId.parse("AbCdEfGhIj");

describe("live tickets", () => {
	it("verifies a ticket for its poll until it is 60 s old", async () => {
		const ticket = await issueLiveTicket(SECRET, POLL, "voter", NOW);

		expect(await verifyLiveTicket(SECRET, ticket, POLL, NOW)).toBe(true);
		expect(await verifyLiveTicket(SECRET, ticket, POLL, NOW + 59_999)).toBe(true);
		expect(await verifyLiveTicket(SECRET, ticket, POLL, NOW + 60_000)).toBe(false);
	});

	it("refuses a ticket for another poll", async () => {
		const ticket = await issueLiveTicket(SECRET, POLL, "voter", NOW);

		expect(await verifyLiveTicket(SECRET, ticket, "ZyXwVuTsRq", NOW)).toBe(false);
	});

	it("refuses a tampered ticket", async () => {
		const ticket = await issueLiveTicket(SECRET, POLL, "voter", NOW);
		const later = ticket.replace(`.${NOW + 60_000}.`, `.${NOW + 600_000}.`);

		expect(await verifyLiveTicket(SECRET, later, POLL, NOW + 60_000)).toBe(false);
		expect(await verifyLiveTicket("o".repeat(32), ticket, POLL, NOW)).toBe(false);
	});

	it("refuses the same text signed as a voter cookie", async () => {
		const cookieValue = await signValue(SECRET, "voter", `${POLL}.${NOW + 60_000}.voter`);

		expect(await verifyLiveTicket(SECRET, cookieValue, POLL, NOW)).toBe(false);
	});
});
