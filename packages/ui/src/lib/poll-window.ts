/**
 * Duration display helpers. The limits and the close rule live in the domain;
 * these only pick and print minutes.
 */

/** Slider stops, in minutes. Fixed steps keep every value a round number. */
export const WINDOW_STEPS = [1, 2, 5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 960, 1200, 1440] as const

/** Quick-pick buttons (minutes). Each one is also a slider stop. */
export const WINDOW_PRESETS = [1, 15, 60, 360, 1440] as const

export const DEFAULT_WINDOW_MINUTES = 60

/** How long before the close the countdown switches to its ending style. */
export const ENDING_SOON_MS = 60_000

/** Index of the slider stop closest to `minutes`. */
export function nearestStepIndex(minutes: number): number {
  let best = 0
  WINDOW_STEPS.forEach((s, i) => {
    if (Math.abs(s - minutes) < Math.abs(WINDOW_STEPS[best]! - minutes)) best = i
  })
  return best
}

/** Minutes as text: 1 is "1 min", 90 is "1 h 30 min", 1440 is "24 h". */
export function formatWindow(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Countdown text: "5h 12m" for an hour or more, otherwise "14:32". It rounds up, so it reads "0:00" exactly at the close. */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(r).padStart(2, "0")}`
}

/** Spoken version for screen readers: "14 minutes 32 seconds". */
export function formatRemainingLong(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const parts = [h && `${h} hour${h > 1 ? "s" : ""}`, m && `${m} minute${m > 1 ? "s" : ""}`, !h && r && `${r} second${r > 1 ? "s" : ""}`]
  return parts.filter(Boolean).join(" ") || "0 seconds"
}

/** "21:40 today" / "09:15 tomorrow", in the browser's time zone. Client only. */
export function formatClosingTime(at: number, now: number): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  const sameDay = d.toDateString() === new Date(now).toDateString()
  return `${time} ${sameDay ? "today" : "tomorrow"}`
}
