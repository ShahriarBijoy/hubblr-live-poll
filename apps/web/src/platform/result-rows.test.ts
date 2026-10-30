import { describe, expect, it } from "vitest";
import { resultRows } from "./result-rows";

const options = [
	{ id: 1, label: "Tabs" },
	{ id: 2, label: "Spaces" },
	{ id: 3, label: "Both" },
];

describe("resultRows", () => {
	it("gives shares that add up to 100 where plain rounding gives 99", () => {
		const rows = resultRows(options, { 1: 1, 2: 1, 3: 1 });

		expect(rows.map((row) => row.percent)).toEqual([34, 33, 33]);
	});

	it("keeps the option order and fills missing counts with zero", () => {
		expect(resultRows(options, { 2: 3 })).toEqual([
			{ id: "1", label: "Tabs", votes: 0, percent: 0 },
			{ id: "2", label: "Spaces", votes: 3, percent: 100 },
			{ id: "3", label: "Both", votes: 0, percent: 0 },
		]);
	});
});
