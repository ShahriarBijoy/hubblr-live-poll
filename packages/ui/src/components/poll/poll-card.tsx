import * as React from "react"

import { cn } from "#lib/utils"
import { toneStyle, type Tone } from "#lib/poll-tones"

/**
 * The tone-colored poll card: meta row, question, body, and an optional footer.
 * Every poll screen uses it, so the padding, radius and type scale stay the same everywhere.
 */
type PollCardProps = React.ComponentProps<"section"> & { tone?: Tone }

function PollCard({ tone = "flame", className, style, ...props }: PollCardProps) {
  return (
    <section
      data-slot="poll-card"
      style={toneStyle(tone, style)}
      className={cn(
        "flex flex-col gap-6 rounded-[28px] bg-tone p-6 text-on-tone [transition:--tone_.35s_ease] motion-reduce:transition-none sm:p-8",
        className
      )}
      {...props}
    />
  )
}

/** Small line above the question: a status on the left, a control or time on the right. */
function PollCardMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="poll-card-meta"
      className={cn("flex min-h-10 flex-wrap items-center justify-between gap-3 text-sm font-semibold text-on-tone/72", className)}
      {...props}
    />
  )
}

/** The question. */
function PollCardTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="poll-card-title"
      className={cn("font-display-wide text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] text-balance break-words", className)}
      {...props}
    />
  )
}

/** Bottom row under a hairline: facts on the left, an action on the right. */
function PollCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="poll-card-footer"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-t border-on-tone/16 pt-5 text-sm font-semibold text-on-tone/72",
        className
      )}
      {...props}
    />
  )
}

export { PollCard, PollCardMeta, PollCardTitle, PollCardFooter }
export type { PollCardProps }
