import type { Transition, Variants } from "motion/react"

/**
 * One place for every animation number in the poll UI.
 * Wrap the app in <MotionConfig reducedMotion="user"> so all of these
 * turn into instant changes for people who ask for reduced motion.
 */
export const spring = {
  /** Page and card entrances. */
  enter: { type: "spring", duration: 0.4, bounce: 0 } satisfies Transition,
  /** Pills that slide between items (segmented control, selected answer). */
  glide: { type: "spring", stiffness: 500, damping: 38 } satisfies Transition,
  /** Small things that pop in (check marks, "Leading" tag). A little bounce, no wobble. */
  pop: { type: "spring", duration: 0.3, bounce: 0.15 } satisfies Transition,
  /** Result bar fill + counters. Soft so live updates feel calm. */
  bar: { type: "spring", stiffness: 120, damping: 22, mass: 1 } satisfies Transition,
  /** List reflow when answers are added or removed. */
  layout: { type: "spring", stiffness: 420, damping: 36 } satisfies Transition,
} as const

/** Parent: <motion.div variants={stagger} initial="hidden" animate="show"> */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
}

/** Child of `stagger`. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring.enter },
}

/** Answer rows in the composer. Use with <AnimatePresence mode="popLayout">. */
export const listItem = {
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16 } },
  transition: spring.layout,
} as const

/** One-shot shake for an invalid field. Animate `x` to this. */
export const shake = [0, -6, 6, -3, 0]

/** Delay between result bars on first reveal (seconds). */
export const BAR_STAGGER = 0.07
