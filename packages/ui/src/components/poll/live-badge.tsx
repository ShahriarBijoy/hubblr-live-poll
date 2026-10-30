import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Lock } from "lucide-react"

import { cn } from "#lib/utils"

/**
 * The "● Live · 128 votes" pill. `status` is the state of the live
 * WebSocket connection.
 */
const badgeVariants = cva(
  "inline-flex h-8 w-fit items-center gap-2 rounded-full pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap",
  {
    variants: {
      surface: {
        /** On a tone card: ink pill, dot in the tone accent. */
        tone: "bg-ink text-foreground [--dot:var(--tone-accent)]",
        /** On the dark ground or the card surface. */
        dark: "bg-muted text-foreground [--dot:var(--tone-flame)]",
      },
    },
    defaultVariants: { surface: "tone" },
  }
)

/** `closed` means voting ended and the results are final. */
type LiveStatus = "live" | "connecting" | "offline" | "closed"

type LiveBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    status?: LiveStatus
  }

const defaultLabel: Record<LiveStatus, string> = {
  live: "Live",
  connecting: "Reconnecting…",
  offline: "Offline · showing last results",
  closed: "Poll closed",
}

function LiveBadge({ status = "live", surface, className, children, ...props }: LiveBadgeProps) {
  return (
    <span
      data-slot="live-badge"
      data-status={status}
      role="status"
      className={cn(badgeVariants({ surface }), (status === "connecting" || status === "offline") && "text-muted-foreground", className)}
      {...props}
    >
      {status === "closed" ? (
        <Lock className="size-3.5" strokeWidth={2.2} aria-hidden />
      ) : (
      <span className="relative flex size-2" aria-hidden>
        {status === "live" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-(--dot) opacity-75 motion-reduce:animate-none" />
        )}
        <span
          className={cn(
            "relative size-2 rounded-full",
            status === "live" && "bg-(--dot)",
            status === "connecting" && "animate-pulse bg-danger-soft motion-reduce:animate-none",
            status === "offline" && "bg-muted-foreground"
          )}
        />
      </span>
      )}
      <span>{children ?? defaultLabel[status]}</span>
    </span>
  )
}

export { LiveBadge }
export type { LiveBadgeProps, LiveStatus }
