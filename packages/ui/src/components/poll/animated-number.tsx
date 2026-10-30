import type * as React from "react"

import { cn } from "#lib/utils"

/**
 * Number that counts to its new value. Use for vote counts, totals and percentages.
 * Screen readers read the real value; the counting digits are decoration.
 */
type AnimatedNumberProps = {
  value: number
  /** Appended after the number, e.g. "%". */
  suffix?: string
  /** Count up from 0 when it first appears (results reveal). Default true. */
  fromZero?: boolean
  className?: string
}

function AnimatedNumber({ value, suffix = "", fromZero = true, className }: AnimatedNumberProps) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only">{`${value}${suffix}`}</span>
      <span
        aria-hidden
        data-suffix={suffix}
        className={cn("animated-number [--num:var(--num-to)]", fromZero && "starting:[--num:0]")}
        style={{ "--num-to": value } as React.CSSProperties}
      />
    </span>
  )
}

export { AnimatedNumber }
export type { AnimatedNumberProps }
