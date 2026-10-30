import { useSyncExternalStore } from "react";

function subscribeToSeconds(onTick: () => void): () => void {
	const timer = setInterval(onTick, 1000);
	return () => clearInterval(timer);
}

function currentSecond(): number {
	return Math.floor(Date.now() / 1000) * 1000;
}

// The browser clock, ticking once a second, in whole seconds. null in the server render and during hydration, so the
// first client render prints the same HTML as the server.
export function useNow(): number | null {
	return useSyncExternalStore(subscribeToSeconds, currentSecond, () => null);
}
