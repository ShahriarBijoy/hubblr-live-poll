import type { ClosedBy, PollStatus } from "@poll-request/domain";
import { Button } from "@poll-request/ui/components/button";
import { useNow } from "@poll-request/ui/hooks/use-now";
import { countdownAt, type Countdown } from "@poll-request/ui/lib/countdown";
import { AppHeader, PollState } from "@poll-request/ui/poll/poll-surfaces";
import { useState, useSyncExternalStore } from "react";

export const CLOSED_TEXT: Record<ClosedBy, string> = {
	creator: "Closed by the creator.",
	timer: "Time is up.",
};

// The server clock now, ticking once a second. The server render and hydration read serverNow, so the first client
// render prints the same countdown as the HTML. The offset to the browser clock is fixed at the first client render.
export function useServerClock(serverNow: number): number {
	const [offset] = useState(() => serverNow - Date.now());
	const now = useNow();
	return now === null ? serverNow : now + offset;
}

// Closed for a creator close as well as a timer close. `status` is the status at `now` (statusAt).
export function pollCountdown(status: PollStatus, now: number): Countdown {
	return countdownAt(status.kind === "open" ? status.closesAt : null, now);
}

function subscribeToNothing(): () => void {
	return () => {};
}

// A full URL for the share fields. The server does not know the origin the visitor used, so the server render and
// hydration show the path, and the first client render after that shows the full URL.
export function useShareUrl(path: string): string {
	return useSyncExternalStore(subscribeToNothing, () => `${window.location.origin}${path}`, () => path);
}

export function PollNotFound() {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<AppHeader />
			<main className="px-5 pt-10 pb-16 sm:px-8">
				<PollState
					title="Poll not found"
					description="The link may be wrong, or the poll was deleted 7 days after it closed."
					action={
						<Button asChild>
							<a href="/">Create a poll</a>
						</Button>
					}
				/>
			</main>
		</div>
	);
}
