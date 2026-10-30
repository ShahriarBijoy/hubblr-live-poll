import * as React from "react"
import { MotionConfig, motion } from "motion/react"
import { Plus } from "lucide-react"

import { Button } from "#components/button"

import { cn } from "#lib/utils"
import { riseItem, stagger } from "#lib/poll-motion"

/** Wrap the app once: every animation turns into an instant change for people who ask for reduced motion. */
function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** The app name, in one place. */
const APP_NAME = "Live Poll"

/** Top bar: the app name on the left, actions on the right. */
function AppHeader({ actions, className }: { actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mx-auto flex h-20 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-8", className)}>
      <a href="/" className="font-display text-xl font-extrabold tracking-[-0.01em] [font-stretch:115%]">
        {APP_NAME}
      </a>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Outline "New poll" link for the header, for pages without a router link to pass in. */
function NewPollButton() {
  return (
    <Button asChild variant="outline">
      <a href="/">
        <Plus aria-hidden />
        New poll
      </a>
    </Button>
  )
}

/** Page heading with an optional line under it. Left-aligned with the grid below. */
function PageTitle({ title, description, className }: { title: React.ReactNode; description?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex max-w-[640px] flex-col gap-3", className)}>
      <h1 className="font-display-wide text-[clamp(2rem,4vw,2.75rem)] leading-[1.05] text-balance">{title}</h1>
      {description && <p className="text-base text-muted-foreground">{description}</p>}
    </div>
  )
}

/** Page container that staggers the entrance of its direct <PageSection> children. */
function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.main
      variants={stagger}
      initial="hidden"
      animate="show"
      className={cn("mx-auto max-w-[1120px] px-5 pt-4 pb-16 sm:px-8", className)}
    >
      {children}
    </motion.main>
  )
}

/** Child of PageShell that rises in with the stagger. */
function PageSection({ className, ...props }: React.ComponentProps<typeof motion.div>) {
  return <motion.div variants={riseItem} className={className} {...props} />
}

/** Two-column view grid: the card takes 7 columns and the side column 5. It stacks below the lg breakpoint. */
function ViewGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-1 items-start gap-6 lg:grid-cols-12", className)} {...props} />
}

/** Dark surface panel for the side column (Invite voters, Your vote …). */
function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel" className={cn("flex flex-col gap-4 rounded-[28px] bg-card p-6", className)} {...props} />
}

function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-display-wide text-xl leading-[1.2]", className)} {...props} />
}

/** "Votes so far / 128" tile. */
function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[28px] bg-card p-6", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-display-wide text-[2rem] leading-[1.15]">{value}</div>
      {hint && <div className="text-sm font-semibold text-tone-accent">{hint}</div>}
    </div>
  )
}

/** Dashed outline card for an empty, not-found, or error state. */
function PollState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mx-auto flex max-w-md flex-col items-start gap-3 rounded-[28px] border-[1.5px] border-dashed border-border p-6",
        className
      )}
    >
      {icon && <span className="grid size-13 place-items-center rounded-full bg-muted [&_svg]:size-[22px]">{icon}</span>}
      <h2 className="font-display-wide text-2xl leading-[1.15]">{title}</h2>
      {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  )
}

export { MotionRoot, AppHeader, NewPollButton, PageTitle, PageShell, PageSection, ViewGrid, Panel, PanelTitle, StatTile, PollState }
