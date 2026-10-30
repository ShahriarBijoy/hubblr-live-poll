import { ENDING_SOON_MS, formatRemaining, formatRemainingLong } from "#lib/poll-window"

export type Countdown = {
  msLeft: number
  closed: boolean
  /** Last minute. */
  ending: boolean
  /** 1 → 0 share of the window left (1 if opensAt is unknown). */
  fraction: number
  /** "14:32" / "5h 12m" */
  label: string
  /** "14 minutes 32 seconds" */
  spoken: string
}

/**
 * The countdown at `now`. `closesAt` is null once the poll is closed (by the creator or the timer).
 * The page passes ONE hydration-safe clock in, so the server and the first client render agree.
 */
export function countdownAt(closesAt: number | null, now: number, opensAt?: number): Countdown {
  const msLeft = closesAt === null ? 0 : Math.max(0, closesAt - now)
  const closed = msLeft <= 0
  const total = closesAt !== null && opensAt != null ? Math.max(1, closesAt - opensAt) : undefined
  return {
    msLeft,
    closed,
    ending: !closed && msLeft <= ENDING_SOON_MS,
    fraction: total ? Math.min(1, msLeft / total) : 1,
    label: formatRemaining(msLeft),
    spoken: formatRemainingLong(msLeft),
  }
}
