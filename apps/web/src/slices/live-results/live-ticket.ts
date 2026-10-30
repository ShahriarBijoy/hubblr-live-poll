import type { PollId } from "@poll-request/domain";
import { signValue, verifySignedValue } from "../../platform/signed-value";

// The ticket travels in the upgrade URL, because a browser cannot send headers on a WebSocket upgrade. The short life
// limits the risk if a log keeps the URL.
const TICKET_LIFE_MS = 60_000;

export type LiveRole = "voter" | "creator";

// `${pollId}.${expiresAt}.${role}`, signed with its own purpose so a voter cookie never passes as a ticket.
export function issueLiveTicket(secret: string | undefined, pollId: PollId, role: LiveRole, now: number): Promise<string> {
	return signValue(secret, "live-ticket", `${pollId}.${now + TICKET_LIFE_MS}.${role}`);
}

export async function verifyLiveTicket(
	secret: string | undefined,
	ticket: string,
	pollId: string,
	now: number,
): Promise<boolean> {
	const value = await verifySignedValue(secret, "live-ticket", ticket);
	if (value === null) return false;
	const [ticketPollId, expiresAt, role] = value.split(".");
	return ticketPollId === pollId && Number(expiresAt) > now && (role === "voter" || role === "creator");
}
