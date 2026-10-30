import { cn } from "#lib/utils"
import { AppHeader } from "./poll-surfaces"

/** A placeholder block. It pulses only for people who allow motion. */
function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-full bg-muted motion-safe:animate-pulse", className)} />
}

/** The poll card while its data loads, on the same padding, radius and rows as PollCard. */
function PollCardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-[28px] bg-card p-6 sm:p-8", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-9 w-4/5 rounded-xl" />
        <Skeleton className="h-9 w-1/2 rounded-xl" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

/** A side panel while its data loads: title, one line, and a link field. */
function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-[28px] bg-card p-6", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
      <Skeleton className="h-[60px] w-full" />
    </div>
  )
}

/** A whole poll page while a route loads. */
function PollPageSkeleton() {
  return (
    <div className="min-h-dvh bg-background text-foreground" role="status">
      <span className="sr-only">Loading the poll</span>
      <AppHeader />
      <main className="mx-auto max-w-[1120px] px-5 pt-4 pb-16 sm:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <PollCardSkeleton className="min-w-0 lg:col-span-7" />
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            <PanelSkeleton />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-[116px] w-full rounded-[28px]" />
              <Skeleton className="h-[116px] w-full rounded-[28px]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export { PollCardSkeleton, PanelSkeleton, PollPageSkeleton }
