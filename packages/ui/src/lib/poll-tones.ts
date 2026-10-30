import type { CSSProperties } from "react"

/**
 * Card colors, from the palette:
 *   Burning Flame #FFB162 · Truffle Trouble #A35139 · Oatmeal #C9C1B1 · Palladian #EEE9DF
 * Each tone has its own text color (`--on-tone`) so text always passes 4.5:1:
 * Abyssal ink on the light tones, Palladian on Truffle.
 */
export const TONES = ["flame", "truffle", "oatmeal", "palladian"] as const
export type Tone = (typeof TONES)[number]

export const TONE_LABELS: Record<Tone, string> = {
  flame: "Burning Flame",
  truffle: "Truffle",
  oatmeal: "Oatmeal",
  palladian: "Palladian",
}

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value)
}

/**
 * Sets the three tone variables on an element. Spread into `style`.
 *   --tone         card fill            → bg-tone
 *   --on-tone      text/icons ON a tone → text-on-tone
 *   --tone-accent  tone-colored text on the dark ground or an ink pill → text-tone-accent
 */
export function toneStyle(tone: Tone = "flame", style?: CSSProperties): CSSProperties {
  return {
    ["--tone" as string]: `var(--tone-${tone})`,
    ["--on-tone" as string]: `var(--on-tone-${tone})`,
    ["--tone-accent" as string]: `var(--tone-accent-${tone})`,
    ...style,
  } as CSSProperties
}
