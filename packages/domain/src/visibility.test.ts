import { describe, expect, it } from "vitest";
import { countsVisible, type PollStatus, type ViewerRole } from "./index";

const OPEN: PollStatus = { kind: "open", closesAt: 1_700_000_300_000 };
const CLOSED: PollStatus = { kind: "closed", closedAt: 1_700_000_100_000, closedBy: "creator" };

describe("countsVisible", () => {
	it.each<[ViewerRole, PollStatus, boolean]>([
		["creator", OPEN, true],
		["creator", CLOSED, true],
		["voter", OPEN, true],
		["voter", CLOSED, true],
		["non-voter", OPEN, false],
		["non-voter", CLOSED, true],
	])("shows the counts to a %s on a poll that is %o: %s", (role, status, visible) => {
		expect(countsVisible(role, status)).toBe(visible);
	});
});
