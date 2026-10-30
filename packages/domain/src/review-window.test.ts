import { describe, expect, it } from "vitest";
import { DurationSec } from "./index";

describe("DurationSec", () => {
	it.each([60, 900, 3600, 86400])("accepts %s", (value) => {
		expect(DurationSec.parse(value)).toBe(value);
	});

	it.each([0, 59, 90, 86460, 604800, 1.5, "3600"])("rejects %s", (value) => {
		expect(DurationSec.safeParse(value).success).toBe(false);
	});
});
