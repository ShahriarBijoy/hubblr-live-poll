import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./live-poll";

describe("the reconnect delay", () => {
	it("doubles from 0.5 s and stops at 10 s", () => {
		expect([0, 1, 2, 3, 4, 5, 10].map((attempt) => reconnectDelay(attempt, 0.5))).toEqual([
			500, 1000, 2000, 4000, 8000, 10_000, 10_000,
		]);
	});

	it("spreads each delay by up to 20% and never goes over 10 s", () => {
		expect(reconnectDelay(1, 0)).toBe(800);
		expect(reconnectDelay(1, 1)).toBe(1200);
		expect(reconnectDelay(10, 1)).toBe(10_000);
	});
});
