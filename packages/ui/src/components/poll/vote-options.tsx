import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { RadioGroup } from "radix-ui"
import { Check } from "lucide-react"

import { cn } from "#lib/utils"
import { spring } from "#lib/poll-motion"

export type PollOption = { id: string; label: string }

/**
 * The answers on the vote view, on a Radix RadioGroup: the group is one tab stop,
 * the arrow keys move the selection, and screen readers announce a radio group.
 * The black "selected" fill is one motion element with a shared layoutId,
 * so it slides from row to row.
 */
type VoteOptionGroupProps = {
  options: PollOption[]
  value: string | undefined
  onValueChange: (optionId: string) => void
  disabled?: boolean
  /** Label for the group (visually hidden). */
  label?: string
  className?: string
}

function VoteOptionGroup({
  options,
  value,
  onValueChange,
  disabled,
  label = "Pick one answer",
  className,
}: VoteOptionGroupProps) {
  const id = React.useId()

  return (
    <RadioGroup.Root
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-label={label}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {options.map((option, i) => {
        const selected = option.id === value
        return (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.enter, delay: 0.08 + i * 0.05 }}
          >
            <RadioGroup.Item
              value={option.id}
              className={cn(
                "group relative flex h-16 w-full items-center gap-3.5 rounded-full pr-6 pl-3.5 text-left text-lg font-semibold",
                "transition-[transform,color,background-color] duration-150 ease-out-strong",
                "hover:translate-x-1 active:scale-[.98] motion-reduce:transition-none motion-reduce:hover:translate-x-0",
                "outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-on-tone",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0",
                selected ? "text-foreground" : "bg-ink/12 text-on-tone hover:bg-ink/20"
              )}
            >
              {selected && (
                <motion.span
                  layoutId={`vote-fill-${id}`}
                  transition={spring.glide}
                  className="absolute inset-0 rounded-full bg-ink"
                  aria-hidden
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 grid size-9 flex-none place-items-center rounded-full border-2 transition-colors duration-200",
                  selected ? "border-tone bg-tone" : "border-on-tone/55 group-hover:border-on-tone"
                )}
              >
                <RadioGroup.Indicator forceMount>
                  <AnimatePresence initial={false}>
                    {selected && (
                      <motion.span
                        className="block"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.1 } }}
                        transition={spring.pop}
                      >
                        <Check className="size-[18px] text-on-tone" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </RadioGroup.Indicator>
              </span>
              <span className="relative z-10 flex-1 truncate">{option.label}</span>
              <AnimatePresence>
                {selected && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="relative z-10 text-[13px] font-semibold text-tone-accent"
                  >
                    Your pick
                  </motion.span>
                )}
              </AnimatePresence>
            </RadioGroup.Item>
          </motion.div>
        )
      })}
    </RadioGroup.Root>
  )
}

export { VoteOptionGroup }
export type { VoteOptionGroupProps }
