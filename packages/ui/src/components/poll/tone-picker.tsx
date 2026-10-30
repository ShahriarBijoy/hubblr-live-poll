import { RadioGroup } from "radix-ui"

import { cn } from "#lib/utils"
import { TONES, TONE_LABELS, isTone, type Tone } from "#lib/poll-tones"

/** Row of round swatches. Radix RadioGroup: arrow keys move + select. */
type TonePickerProps = {
  value: Tone
  onValueChange: (tone: Tone) => void
  className?: string
  "aria-label"?: string
}

function TonePicker({ value, onValueChange, className, "aria-label": ariaLabel = "Card color" }: TonePickerProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => isTone(v) && onValueChange(v)}
      aria-label={ariaLabel}
      orientation="horizontal"
      className={cn("flex items-center gap-3", className)}
    >
      {TONES.map((tone) => (
        <RadioGroup.Item
          key={tone}
          value={tone}
          aria-label={TONE_LABELS[tone]}
          style={{ backgroundColor: `var(--tone-${tone})` }}
          className={cn(
            "size-[34px] rounded-full shadow-[inset_0_0_0_1.5px_rgb(27_38_50/.3)]",
            "transition-[transform,box-shadow] duration-150 ease-out-strong hover:scale-105 motion-reduce:transition-none",
            // Selected: gap ring in the card's tone, then a ring in the card's text color.
            "data-[state=checked]:shadow-[0_0_0_3px_var(--tone),0_0_0_5px_var(--on-tone)]",
            "outline-none focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-on-tone"
          )}
        />
      ))}
    </RadioGroup.Root>
  )
}

export { TonePicker }
export type { TonePickerProps }
