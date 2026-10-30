import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManageView } from "./close-poll.view";

describe("the manage view", () => {
	it("renders a loading skeleton on the server, which never sees the admin link after the #", () => {
		const html = renderToString(<ManageView pollId="AbCdEfGhIj" />);

		expect(html).toContain('role="status"');
		expect(html).toContain("Loading the poll");
		expect(html).not.toContain("This admin link is incomplete.");
	});
});
