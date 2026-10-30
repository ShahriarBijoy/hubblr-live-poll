import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Crown } from "lucide-react"

import { cn } from "#lib/utils"
import { BAR_STAGGER, spring } from "#lib/poll-motion"
import { AnimatedNumber } from "./animated-number"

// `percent` comes from the app, so every view rounds the same way and the shares add up to 100.
export type PollResult = { id: string; label: string; votes: number; percent: number }

/** Minimum visible fill when an answer has at least one vote. */
const MIN_FILL_PX = 64

const FILL_MOTION = "duration-700 ease-out-soft motion-reduce:transition-none"

/**
 * One result row: translucent ink track, solid ink fill.
 * The label is drawn twice, in ink on the track and in light text clipped
 * to the fill, so it flips color exactly at the fill edge.
 * When `votes` goes up (live update) a "+1" chip rises and the bar flashes.
 */
type ResultBarProps = {
  label: React.ReactNode
  votes: number
  percent: number
  leading?: boolean
  /** Tag text for the leader. "Winner" once the poll is closed. */
  leadLabel?: string
  mine?: boolean
  /** Position in the list; drives the reveal stagger. */
  index?: number
  className?: string
}

function ResultBar({ label, votes, percent, leading, leadLabel = "Leading", mine, index = 0, className }: ResultBarProps) {
  const reduce = useReducedMotion()
  const pct = percent
  const rounded = percent
  const fillStyle = {
    "--fill": pct > 0 ? `max(${MIN_FILL_PX}px, ${pct}%)` : "0px",
    transitionDelay: `${index * BAR_STAGGER}s`,
  } as React.CSSProperties

  // Live "+1" bumps: compare with the count of the last render, adjusted during render instead of in an effect.
  const [seenVotes, setSeenVotes] = React.useState(votes)
  const [bumps, setBumps] = React.useState<number[]>([])
  if (votes !== seenVotes) {
    setSeenVotes(votes)
    if (votes > seenVotes) setBumps((b) => [...b, votes])
  }
  const lastBump = bumps.at(-1)

  const voteText = `${votes} ${votes === 1 ? "vote" : "votes"}`
  const content = (
    <>
      <span className="flex-1 truncate">{label}</span>
      <span className="hidden font-mono text-sm tabular-nums sm:inline">{voteText}</span>
      <AnimatedNumber value={rounded} suffix="%" className="w-[52px] text-right font-bold" />
    </>
  )

  return (
    <li data-slot="result-bar" className={cn("relative list-none", className)}>
      <div
        role="img"
        aria-label={`${typeof label === "string" ? label : "Answer"}: ${voteText}, ${rounded} percent${leading ? `, ${leadLabel.toLowerCase()}` : ""}${mine ? ", your vote" : ""}`}
        className="relative h-16 overflow-hidden rounded-full bg-ink/16"
      >
        {/* CSS transitions keep the server HTML at the real width; @starting-style plays the first reveal.
            The width goes through --fill because an inline width would beat the @starting-style rule. */}
        <div
          className={cn(FILL_MOTION, "absolute inset-y-0 left-0 w-(--fill) rounded-full bg-ink transition-[width] starting:w-0")}
          style={fillStyle}
        />
        <div className="absolute inset-0 flex items-center gap-2.5 px-4 text-[17px] sm:px-[22px] font-semibold text-on-tone">
          {content}
        </div>
        <div
          aria-hidden
          className={cn(
            FILL_MOTION,
            "absolute inset-0 flex items-center gap-2.5 px-4 text-[17px] sm:px-[22px] font-semibold text-foreground",
            "[clip-path:inset(0_calc(100%-var(--fill))_0_0)] transition-[clip-path] starting:[clip-path:inset(0_100%_0_0)]"
          )}
          style={fillStyle}
        >
          {content}
        </div>
      </div>
      {lastBump !== undefined && !reduce && (
        <motion.span
          key={lastBump}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-full"
          initial={{ boxShadow: "0 0 0 0px rgb(27 38 50 / .45)" }}
          animate={{ boxShadow: "0 0 0 10px rgb(27 38 50 / 0)" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      )}

      <div className="pointer-events-none absolute -top-2.5 right-[18px] flex gap-1.5">
        <AnimatePresence>
          {leading && (
            <motion.span
              key="lead"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={spring.pop}
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ink px-2.5 text-xs font-bold text-foreground"
            >
              <Crown className="size-3 text-primary" strokeWidth={2.4} aria-hidden />
              {leadLabel}
            </motion.span>
          )}
        </AnimatePresence>
        {mine && (
          <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-xs font-bold text-tone-accent">
            Your vote
          </span>
        )}
        <AnimatePresence>
          {bumps.map((b) => (
            <motion.span
              key={b}
              aria-hidden
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -8], scale: [0.8, 1, 1, 1] }}
              transition={{ duration: 1.4, times: [0, 0.25, 0.8, 1] }}
              onAnimationComplete={() => setBumps((all) => all.filter((x) => x !== b))}
              className="inline-flex h-6 items-center rounded-full bg-ink px-2 text-xs font-bold text-foreground"
            >
              +1
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </li>
  )
}

/**
 * All result rows. It works out the total, and the leader when exactly one answer leads.
 * The rows keep the order they are given, so they never jump during live updates.
 */
type ResultListProps = {
  results: PollResult[]
  /** Option id the current visitor voted for. */
  myVoteId?: string
  /** True once the poll is closed. The leader tag then reads "Winner". */
  final?: boolean
  className?: string
}

function ResultList({ results, myVoteId, final = false, className }: ResultListProps) {
  const max = Math.max(0, ...results.map((r) => r.votes))
  const leaders = results.filter((r) => r.votes === max && max > 0)

  return (
    <ul aria-label="Results" className={cn("flex flex-col gap-2.5 p-0", className)}>
      {results.map((r, i) => (
        <ResultBar
          key={r.id}
          index={i}
          label={r.label}
          votes={r.votes}
          percent={r.percent}
          leading={leaders.length === 1 && leaders[0]?.id === r.id}
          leadLabel={final ? "Winner" : "Leading"}
          mine={r.id === myVoteId}
        />
      ))}
    </ul>
  )
}

/** The verdict under the bars, and how many people watch while the poll is open. */
type ResultSummaryProps = {
  results: PollResult[]
  /** Open sockets on the poll. Shown only while `open`. */
  viewers?: number
  open?: boolean
  className?: string
}

function ResultSummary({ results, viewers = 0, open = false, className }: ResultSummaryProps) {
  const max = Math.max(0, ...results.map((r) => r.votes))
  const leaders = results.filter((r) => r.votes === max && max > 0)
  const verdict =
    max === 0
      ? "No votes yet."
      : leaders.length === 1
        ? open
          ? `${leaders[0]?.label} is leading.`
          : `${leaders[0]?.label} won.`
        : "Tied at the top."

  return (
    <div className={cn("flex flex-col gap-1 text-sm font-semibold text-on-tone/72", className)}>
      <p>{verdict}</p>
      {open && viewers > 0 && (
        <p>{viewers === 1 ? "1 person watching live" : `${viewers} people watching live`}</p>
      )}
    </div>
  )
}

export { ResultBar, ResultList, ResultSummary }
export type { ResultBarProps, ResultListProps, ResultSummaryProps }
