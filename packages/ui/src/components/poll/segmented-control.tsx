import * as React from "react"
import { motion } from "motion/react"
import { ToggleGroup } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "#lib/utils"
import { spring } from "#lib/poll-motion"

/**
 * Pill segmented control (Hot / Best / Controversial, Bars / Chart …).
 * Radix ToggleGroup underneath: roving focus, arrow keys, aria-pressed.
 * The active background is ONE motion element with a shared layoutId,
 * so it slides between items instead of blinking.
 */
const rootVariants = cva("relative inline-flex w-fit items-center gap-1 rounded-full p-1", {
  variants: {
    variant: {
      /** On the black ground. */
      dark: "bg-background",
      /** On the card surface (#181817). */
      card: "bg-background/60",
      /** On a tone card. */
      tone: "bg-ink/14",
    },
    size: {
      default: "[&_[data-slot=segment]]:h-12 [&_[data-slot=segment]]:px-5",
      sm: "[&_[data-slot=segment]]:h-10 [&_[data-slot=segment]]:px-4 [&_[data-slot=segment]]:text-sm",
    },
  },
  defaultVariants: { variant: "dark", size: "default" },
})

const pillByVariant = {
  dark: "bg-muted",
  card: "bg-muted",
  tone: "bg-ink",
} as const

const textByVariant = {
  dark: { on: "text-foreground", off: "text-muted-foreground hover:text-foreground" },
  card: { on: "text-foreground", off: "text-muted-foreground hover:text-foreground" },
  tone: { on: "text-foreground", off: "text-on-tone/80 hover:text-on-tone" },
} as const

type SegmentItem<T extends string> = {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

type SegmentedControlProps<T extends string> = VariantProps<typeof rootVariants> & {
  items: SegmentItem<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  "aria-label": string
}

function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  variant = "dark",
  size,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const id = React.useId()
  const v = variant ?? "dark"

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends "" when the active item is clicked again; ignore it so one is always on.
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={ariaLabel}
      className={cn(rootVariants({ variant, size }), className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <ToggleGroup.Item
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            data-slot="segment"
            className={cn(
              "relative inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-200",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40",
              v === "tone" && "focus-visible:outline-on-tone",
              active ? textByVariant[v].on : textByVariant[v].off
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-pill-${id}`}
                transition={spring.glide}
                className={cn("absolute inset-0 rounded-full", pillByVariant[v])}
                aria-hidden
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2 [&_svg]:size-4">
              {item.icon}
              {item.label}
            </span>
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}

export { SegmentedControl }
export type { SegmentedControlProps, SegmentItem }
