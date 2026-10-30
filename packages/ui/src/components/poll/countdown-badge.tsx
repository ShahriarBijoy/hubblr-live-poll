import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Lock } from "lucide-react"

import { cn } from "#lib/utils"
import { spring } from "#lib/poll-motion"
import type { Countdown } from "#lib/countdown"

const R = 6.5
const C = 2 * Math.PI * R

/**
 * The "◔ Closes in 14:32" pill for a tone card.
 * While open it is an ink pill whose ring, in the card tone, drains every second.
 * In the last minute its colors invert and it pulses.
 * Once closed it shows a lock and "Voting closed", or the children you pass.
 * Pass it the object from countdownAt(), so the page has one clock.
 */
type CountdownBadgeProps = {
  countdown: Countdown
  /** Text when closed. Default "Voting closed". */
  closedLabel?: React.ReactNode
  className?: string
}

function CountdownBadge({ countdown, closedLabel = "Voting closed", className }: CountdownBadgeProps) {
  const reduce = useReducedMotion()
  const { closed, ending, fraction, label, spoken } = countdown
  const phase = closed ? "closed" : ending ? "ending" : "open"

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {closed ? (
        <motion.span
          key="closed"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={spring.pop}
          role="status"
          className={cn(
            "inline-flex h-8 w-fit items-center gap-2 rounded-full bg-ink pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap text-foreground",
            className
          )}
        >
          <Lock className="size-3.5" strokeWidth={2.2} aria-hidden />
          {closedLabel}
        </motion.span>
      ) : (
        <motion.span
          key="open"
          role="timer"
          aria-label={`Voting closes in ${spoken}`}
          data-phase={phase}
          initial={{ opacity: 0, scale: 0.95 }}
          exit={{ opacity: 0, scale: 0.95 }}
          animate={ending && !reduce ? { opacity: 1, scale: [1, 1.06, 1] } : { opacity: 1, scale: 1 }}
          transition={ending && !reduce ? { scale: { duration: 1, repeat: Infinity, ease: "easeInOut" } } : spring.pop}
          className={cn(
            "inline-flex h-8 w-fit items-center gap-[7px] rounded-full pr-3.5 pl-2 text-[13px] font-semibold whitespace-nowrap tabular-nums transition-colors duration-300",
            ending ? "bg-foreground text-ink shadow-[0_0_0_2px_var(--ink)]" : "bg-ink text-foreground",
            className
          )}
        >
          <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden>
            <circle cx="9" cy="9" r={R} fill="none" strokeWidth="2.5" className={ending ? "stroke-ink/15" : "stroke-foreground/20"} />
            <circle
              cx="9"
              cy="9"
              r={R}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fraction)}
              className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", ending ? "stroke-ink" : "stroke-(--tone-accent)")}
            />
          </svg>
          <span aria-hidden suppressHydrationWarning>
            Closes in {label}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export { CountdownBadge }
export type { CountdownBadgeProps }
