import { Hourglass } from "lucide-react"
import { Slider } from "radix-ui"

import { cn } from "#lib/utils"
import { useNow } from "#hooks/use-now"
import { WINDOW_PRESETS, WINDOW_STEPS, formatClosingTime, formatWindow, nearestStepIndex } from "#lib/poll-window"
import { SegmentedControl } from "./segmented-control"

/**
 * The "How long does the link take votes?" control, from 1 min to 24 h.
 * Quick picks with a sliding pill, and a slider over fixed stops for finer choices.
 * The value is in minutes; the server turns it into closes_at.
 * The fill uses the nearest `--tone`.
 */
type WindowPickerProps = {
  /** Minutes, from 1 to 1440. */
  value: number
  onValueChange: (minutes: number) => void
  className?: string
}

function WindowPicker({ value, onValueChange, className }: WindowPickerProps) {
  const now = useNow()
  const idx = nearestStepIndex(value)
  const label = formatWindow(value)

  return (
    <section
      aria-labelledby="window-label"
      className={cn("flex flex-col gap-4 rounded-[28px] bg-card p-6", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span id="window-label" className="inline-flex items-center gap-2 font-semibold">
          <Hourglass className="size-4" aria-hidden />
          Duration
        </span>
        <span className="font-display-wide text-2xl tabular-nums">{label}</span>
      </div>

      <SegmentedControl<string>
        aria-label="Quick picks"
        variant="dark"
        size="sm"
        className="grid w-full grid-cols-5 [&_[data-slot=segment]]:px-0"
        value={String(value)}
        onValueChange={(v) => onValueChange(Number(v))}
        items={WINDOW_PRESETS.map((m) => ({ value: String(m), label: formatWindow(m) }))}
      />

      <div>
        <Slider.Root
          min={0}
          max={WINDOW_STEPS.length - 1}
          step={1}
          value={[idx]}
          onValueChange={([i]) => onValueChange(WINDOW_STEPS[i ?? 0]!)}
          aria-labelledby="window-label"
          className="relative flex h-7 w-full touch-none items-center select-none"
        >
          <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-background">
            <Slider.Range className="absolute h-full rounded-full bg-tone" />
          </Slider.Track>
          <Slider.Thumb
            aria-label="Poll duration"
            aria-valuetext={label}
            className={cn(
              "block size-6 rounded-full bg-foreground shadow-[0_0_0_4px_var(--card)]",
              "transition-transform duration-150 ease-out-strong active:scale-[.97]",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring"
            )}
          />
        </Slider.Root>
        <div className="mt-0.5 flex justify-between text-[13px] text-muted-foreground">
          <span>1 min</span>
          <span>24 h</span>
        </div>
      </div>

      {/* The closing time is in the browser's time zone, so it waits for the first client render. */}
      <p className="text-sm text-muted-foreground">
        {now === null ? (
          `The link takes votes for ${label}`
        ) : (
          <>
            The link takes votes until{" "}
            <b className="font-semibold text-foreground">{formatClosingTime(now + value * 60_000, now)}</b>
          </>
        )}
        . After that it shows the final results.
      </p>
    </section>
  )
}

export { WindowPicker }
export type { WindowPickerProps }
