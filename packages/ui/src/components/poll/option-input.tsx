import * as React from "react"
import { Plus, X } from "lucide-react"

import { cn } from "#lib/utils"

/**
 * One answer row in the composer: black pill on the tone card with a
 * numbered tone dot, a text input and a remove button.
 */
type OptionInputProps = Omit<React.ComponentProps<"input">, "size"> & {
  /** 0-based; shown as index + 1. */
  index: number
  onRemove?: () => void
  /** False disables the remove button (e.g. at the 2-answer minimum). */
  removable?: boolean
  /** Message under the row. */
  error?: string
}

function OptionInput({
  index,
  onRemove,
  removable = true,
  error,
  className,
  id,
  ...props
}: OptionInputProps) {
  const autoId = React.useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div data-slot="option-input" className={cn("flex flex-col gap-1.5", className)}>
      {/* The composer shakes this row on a refused submit. */}
      <div
        data-slot="option-input-field"
        className={cn(
          "flex h-16 items-center gap-3 rounded-full bg-ink pr-2.5 pl-3 text-foreground",
          "outline-on-tone transition-shadow focus-within:outline-2 focus-within:outline-offset-[3px]",
          error && "shadow-[inset_0_0_0_2px_var(--danger-soft)]"
        )}
      >
        <span
          aria-hidden
          className="grid size-9 flex-none place-items-center rounded-full bg-tone text-sm font-bold text-on-tone"
        >
          {index + 1}
        </span>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          aria-label={`Answer ${index + 1}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={`Answer ${index + 1}`}
          className="h-full min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
          {...props}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={!removable}
            aria-label={`Remove answer ${index + 1}`}
            className={cn(
              "grid size-11 flex-none place-items-center rounded-full border border-border transition-[background-color,transform,opacity] duration-150 ease-out-strong",
              "hover:bg-muted active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="pl-5 text-[13px] font-semibold text-on-tone">
          {error}
        </p>
      )}
    </div>
  )
}

/** Dashed "+ Add answer · 3 of 5" pill. */
type AddOptionButtonProps = React.ComponentProps<"button"> & {
  count: number
  max: number
}

function AddOptionButton({ count, max, className, children = "Add answer", ...props }: AddOptionButtonProps) {
  return (
    <button
      type="button"
      data-slot="add-option"
      className={cn(
        "flex h-16 w-full items-center justify-between rounded-full border-2 border-dashed border-on-tone/45 pr-5 pl-3.5 text-[17px] font-semibold text-on-tone",
        "transition-[background-color,transform] duration-150 ease-out-strong hover:bg-ink/8 active:scale-[.98]",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-on-tone",
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-ink/12">
          <Plus className="size-[18px]" strokeWidth={2.2} />
        </span>
        {children}
      </span>
      <span className="text-sm font-medium text-on-tone/70">
        {count} of {max}
      </span>
    </button>
  )
}

export { OptionInput, AddOptionButton }
export type { OptionInputProps, AddOptionButtonProps }
