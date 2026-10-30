import { motion } from "motion/react"

import { cn } from "#lib/utils"
import { BAR_STAGGER, spring } from "#lib/poll-motion"
import { AnimatedNumber } from "./animated-number"
import type { PollResult } from "./result-bar"

/** Shades of the card's text color (--on-tone), strongest first. Works on light and dark tones. */
const mix = (p: number) => `color-mix(in srgb, var(--on-tone) ${p}%, transparent)`
const SHADES = [mix(100), mix(68), mix(42), mix(24), mix(12)]

const R = 84
const C = 2 * Math.PI * R
const GAP = 3

/**
 * The "simple chart" view: donut + legend, drawn in shades of the text color so it
 * works on any tone. Arcs draw from 0 and re-flow on live updates.
 */
type ResultDonutProps = {
  results: PollResult[]
  className?: string
}

function ResultDonut({ results, className }: ResultDonutProps) {
  const total = results.reduce((s, r) => s + r.votes, 0)
  let acc = 0
  const arcs = results.map((r, i) => {
    const frac = total ? r.votes / total : 0
    const len = Math.max(0, frac * C - (frac > 0 ? GAP : 0))
    const arc = { id: r.id, len, offset: -acc, color: SHADES[i % SHADES.length] }
    acc += frac * C
    return arc
  })

  const summary = results
    .map((r) => `${r.label} ${r.percent}%`)
    .join(", ")

  return (
    <div className={cn("flex flex-col items-center gap-8 sm:flex-row", className)}>
      <div className="relative size-[180px] flex-none">
        <svg viewBox="0 0 220 220" className="size-full -rotate-90" role="img" aria-label={summary}>
          <circle cx="110" cy="110" r={R} fill="none" stroke={mix(12)} strokeWidth="32" />
          {arcs.map((a, i) => (
            <motion.circle
              key={a.id}
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="32"
              initial={{ strokeDasharray: `0 ${C}`, strokeDashoffset: 0 }}
              animate={{ strokeDasharray: `${a.len} ${C - a.len}`, strokeDashoffset: a.offset }}
              transition={{ ...spring.bar, delay: i * BAR_STAGGER }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-on-tone">
          <AnimatedNumber value={total} className="font-display-wide text-[40px] leading-none" />
          <span className="text-[13px] font-semibold text-on-tone/72">votes</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-1 flex-col gap-3 text-base font-semibold text-on-tone">
        {results.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3">
            <span aria-hidden className="size-3.5 rounded-full" style={{ background: SHADES[i % SHADES.length] }} />
            <span className="flex-1 truncate">{r.label}</span>
            <span className="font-mono text-sm text-on-tone/72 tabular-nums">{r.votes}</span>
            <AnimatedNumber
              value={r.percent}
              suffix="%"
              className="w-12 text-right font-bold"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export { ResultDonut }
export type { ResultDonutProps }
