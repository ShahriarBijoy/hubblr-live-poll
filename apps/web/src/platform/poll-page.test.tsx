import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PollNotFound } from "./poll-page";

describe("the poll page", () => {
	it("shows the 404 text for an unknown poll", () => {
		const html = renderToString(<PollNotFound />);

		expect(html).toContain("Poll not found");
		expect(html).toContain("Create a poll");
	});
});
