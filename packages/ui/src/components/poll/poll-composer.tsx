import * as React from "react"
import { AnimatePresence, animate, motion } from "motion/react"
import { Send } from "lucide-react"

import { cn } from "#lib/utils"
import { TONE_LABELS, toneStyle, type Tone } from "#lib/poll-tones"
import { listItem, riseItem, shake, spring, stagger } from "#lib/poll-motion"
import { DEFAULT_WINDOW_MINUTES, formatWindow } from "#lib/poll-window"
import { Button } from "#components/button"
import { AddOptionButton, OptionInput } from "./option-input"
import { PollCard, PollCardMeta } from "./poll-card"
import { TonePicker } from "./tone-picker"
import { WindowPicker } from "./window-picker"

export type PollDraft = {
  question: string
  options: string[]
  tone: Tone
  /** How long the public link accepts votes, in minutes from 1 to 1440. The server sets closes_at from it. */
  durationMinutes: number
}

export type PollDraftErrors = {
  question?: string
  /** Keyed by row index. */
  options: Record<number, string>
  window?: string
  form?: string
}

export type PollLimits = { questionMax: number; optionMax: number; minOptions: number; maxOptions: number }

function hasErrors(e: PollDraftErrors) {
  return Boolean(e.question || e.form || e.window || Object.keys(e.options).length)
}

const NO_ERRORS: PollDraftErrors = { options: {} }

type Row = { id: string; value: string }
let rowSeq = 0
const newRow = (value = ""): Row => ({ id: `row-${++rowSeq}`, value })

type PollComposerProps = {
  defaultValue?: Partial<PollDraft>
  limits: PollLimits
  /** The app's rules. The composer shows what it returns once the creator has tried to submit. */
  validate: (draft: PollDraft) => PollDraftErrors
  /** Called with the raw draft when `validate` finds nothing. */
  onSubmit: (draft: PollDraft) => void | Promise<void>
  /** True while the create request is in flight. */
  pending?: boolean
  /** Server error to show under the button. */
  error?: string | null
  /** Shown in place of the add button once the answers reach the maximum. */
  optionLimitText?: string
  className?: string
}

/**
 * The body of the create view: the tone composer card on the left, and the
 * live preview and submit button on the right. It owns its form state.
 */
function PollComposer({
  defaultValue,
  limits,
  validate,
  onSubmit,
  pending = false,
  error,
  optionLimitText,
  className,
}: PollComposerProps) {
  const id = React.useId()
  const [question, setQuestion] = React.useState(defaultValue?.question ?? "")
  const [rows, setRows] = React.useState<Row[]>(() => {
    const initial = defaultValue?.options?.length ? defaultValue.options : ["", ""]
    return initial.map((v) => newRow(v))
  })
  const [tone, setTone] = React.useState<Tone>(defaultValue?.tone ?? "flame")
  const [minutes, setMinutes] = React.useState(defaultValue?.durationMinutes ?? DEFAULT_WINDOW_MINUTES)
  const [attempted, setAttempted] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  const draft: PollDraft = { question, options: rows.map((r) => r.value), tone, durationMinutes: minutes }
  const errors = attempted ? validate(draft) : NO_ERRORS
  const { minOptions, maxOptions, questionMax, optionMax } = limits
  const questionId = `${id}-question`
  const optionId = (row: Row) => `${id}-${row.id}`

  const updateRow = (rowId: string, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, value } : r)))
  const removeRow = (rowId: string) => setRows((rs) => (rs.length <= minOptions ? rs : rs.filter((r) => r.id !== rowId)))
  const addRow = () => {
    setRows((rs) => (rs.length >= maxOptions ? rs : [...rs, newRow()]))
    // Focus the new input after it mounts.
    requestAnimationFrame(() => {
      const inputs = formRef.current?.querySelectorAll<HTMLInputElement>("[data-slot=option-input] input")
      inputs?.[inputs.length - 1]?.focus()
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setAttempted(true)
    const found = validate(draft)
    if (!hasErrors(found)) {
      await onSubmit(draft)
      return
    }
    // The invalid fields are not marked in the DOM until the next render, so find them from the errors.
    const invalid = [
      found.question ? document.getElementById(questionId) : null,
      ...rows.map((row, i) => (found.options[i] ? document.getElementById(optionId(row)) : null)),
    ].filter((el): el is HTMLElement => el !== null)
    invalid[0]?.focus()
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    for (const el of invalid) {
      void animate(el.closest("[data-slot=option-input-field]") ?? el, { x: shake }, { duration: 0.32 })
    }
  }

  const preview = rows.map((r, i) => ({ id: r.id, label: r.value.trim() || `Answer ${i + 1}`, empty: !r.value.trim() }))

  return (
    <motion.form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      variants={stagger}
      initial="hidden"
      animate="show"
      className={cn("grid grid-cols-1 items-start gap-6 lg:grid-cols-12", className)}
    >
      {/* Composer card */}
      <motion.section
        variants={riseItem}
        aria-label="Poll composer"
        style={toneStyle(tone)}
        className="flex min-w-0 flex-col gap-6 rounded-[28px] bg-tone p-6 text-on-tone [transition:--tone_.35s_ease] sm:p-8 lg:col-span-7"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-on-tone/72">
            <label htmlFor={questionId}>Question</label>
            <span className="font-mono text-[13px] tabular-nums" aria-live="polite">
              {question.length} / {questionMax}
            </span>
          </div>
          <textarea
            id={questionId}
            rows={2}
            maxLength={questionMax}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question"
            aria-invalid={errors.question ? true : undefined}
            aria-describedby={errors.question ? `${questionId}-error` : undefined}
            className="w-full max-w-full resize-none bg-transparent font-display-wide text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] text-on-tone caret-on-tone outline-none [field-sizing:content] placeholder:text-on-tone/40"
          />
          {errors.question && (
            <p id={`${questionId}-error`} className="text-[13px] font-semibold">
              {errors.question}
            </p>
          )}
        </div>

        <fieldset className="flex min-w-0 flex-col gap-2.5">
          <legend className="mb-3 flex w-full justify-between text-sm font-semibold text-on-tone/72">
            <span>Answers</span>
            <span>
              {minOptions} to {maxOptions}
            </span>
          </legend>

          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((row, i) => (
                <motion.li key={row.id} layout {...listItem}>
                  <OptionInput
                    id={optionId(row)}
                    index={i}
                    value={row.value}
                    maxLength={optionMax}
                    onChange={(e) => updateRow(row.id, e.target.value)}
                    onRemove={() => removeRow(row.id)}
                    removable={rows.length > minOptions}
                    error={errors.options[i]}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <AnimatePresence initial={false} mode="popLayout">
            {rows.length < maxOptions ? (
              <motion.div key="add" layout {...listItem}>
                <AddOptionButton count={rows.length} max={maxOptions} onClick={addRow} />
              </motion.div>
            ) : (
              optionLimitText && (
                <motion.p key="limit" layout {...listItem} aria-live="polite" className="pl-5 text-sm font-semibold text-on-tone/72">
                  {optionLimitText}
                </motion.p>
              )
            )}
          </AnimatePresence>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-on-tone/16 pt-5">
          <span className="text-sm font-semibold text-on-tone/72">Color · {TONE_LABELS[tone]}</span>
          <TonePicker value={tone} onValueChange={setTone} />
        </div>
      </motion.section>

      {/* Preview and submit */}
      <motion.aside variants={riseItem} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:col-span-5">
        <PollCard tone={tone} aria-label="Preview" className="gap-4 sm:p-6">
          <PollCardMeta className="min-h-0">
            <span>Preview</span>
            <span>Closes in {formatWindow(minutes)}</span>
          </PollCardMeta>
          <p className="font-display-wide text-2xl leading-[1.15] break-words">
            {question.trim() || "Your question shows up here"}
          </p>
          <motion.ul layout className="flex flex-wrap gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {preview.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  {...listItem}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full bg-ink/14 px-4 text-sm font-semibold transition-opacity",
                    p.empty && "opacity-50"
                  )}
                >
                  {p.label}
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </PollCard>

        <WindowPicker value={minutes} onValueChange={setMinutes} />

        <Button type="submit" size="lg" loading={pending} className="w-full">
          <Send aria-hidden />
          Create poll
        </Button>

        <AnimatePresence initial={false} mode="wait">
          {error || (attempted && (errors.form || errors.window)) ? (
            <motion.p
              key="err"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.enter}
              className="text-center text-sm text-danger-soft"
            >
              {error ?? errors.form ?? errors.window}
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-muted-foreground"
            >
              You get a link to share next. The timer starts when you create the poll.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.aside>
    </motion.form>
  )
}

export { PollComposer }
export type { PollComposerProps }
