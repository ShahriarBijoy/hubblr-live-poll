import { describe, expect, it } from "vitest";
import { tally } from "./index";

describe("tally", () => {
	it.each([[[1, 1, 1]], [[2, 1]], [[7, 3, 0]], [[1, 2, 3, 4, 5]], [[1, 1, 1, 1, 1, 1, 1]]])(
		"gives percents that add up to 100 for %j",
		(counts) => {
			expect(tally(counts).percents.reduce((sum, percent) => sum + percent, 0)).toBe(100);
		},
	);

	it("hands the points left to the largest remainders, the lower index first", () => {
		expect(tally([1, 1, 1]).percents).toEqual([34, 33, 33]);
		expect(tally([2, 1]).percents).toEqual([67, 33]);
	});

	it("gives all zeros and no leader when nobody voted", () => {
		expect(tally([0, 0, 0])).toEqual({ percents: [0, 0, 0], leaders: [] });
	});

	it("names one leader, or every option that ties for the most votes", () => {
		expect(tally([7, 3, 0]).leaders).toEqual([0]);
		expect(tally([2, 5, 5]).leaders).toEqual([1, 2]);
	});
});
