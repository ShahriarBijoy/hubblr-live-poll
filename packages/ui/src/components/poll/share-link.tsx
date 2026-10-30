import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Copy, Link2 } from "lucide-react"

import { cn } from "#lib/utils"
import { spring } from "#lib/poll-motion"

/** Copies text; returns [copied, copy]. `copied` resets after `ms`. */
export function useCopy(ms = 1600) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)

  const copy = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Clipboard can be blocked (http, iframe). Fall back to a hidden textarea.
        const ta = document.createElement("textarea")
        ta.value = text
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        ta.remove()
      }
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), ms)
      return true
    },
    [ms]
  )

  return [copied, copy] as const
}

/**
 * Black pill with the poll link and a Copy button. After a copy the button
 * reads "Copied": its icon rotates in, its width animates, and it fills with the tone.
 */
type ShareLinkProps = {
  /** Full URL that gets copied. */
  url: string
  /** Shorter text to show. Defaults to the URL without its protocol. */
  displayUrl?: string
  onCopied?: () => void
  /** The "Copied" fill uses the nearest `--tone` (set by toneStyle on an ancestor). */
  className?: string
}

function ShareLink({ url, displayUrl, onCopied, className }: ShareLinkProps) {
  const [copied, copy] = useCopy()
  const shown = displayUrl ?? url.replace(/^https?:\/\//, "")

  return (
    <div
      data-slot="share-link"
      className={cn("flex h-[60px] items-center gap-2.5 rounded-full bg-background pr-2 pl-5", className)}
    >
      <Link2 className="size-4 flex-none text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-[15px]" title={url}>
        {shown}
      </span>
      <motion.button
        type="button"
        layout
        transition={spring.glide}
        onClick={async () => {
          await copy(url)
          onCopied?.()
        }}
        className={cn(
          "inline-flex h-11 flex-none items-center gap-2 rounded-full px-[18px] text-sm font-bold transition-colors duration-200",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95",
          copied ? "bg-tone text-on-tone" : "bg-foreground text-ink"
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "ok" : "copy"}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.pop}
            className="grid place-items-center"
            aria-hidden
          >
            {copied ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
          </motion.span>
        </AnimatePresence>
        <motion.span layout="position" aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </motion.span>
      </motion.button>
    </div>
  )
}

export { ShareLink }
export type { ShareLinkProps }
