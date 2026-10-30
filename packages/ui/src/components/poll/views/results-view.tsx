import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlignLeft, Check, ChartPie, Plus, Share2 } from "lucide-react"

import { toneStyle, type Tone } from "#lib/poll-tones"
import { spring } from "#lib/poll-motion"
import { Button } from "#components/button"
import { AnimatedNumber } from "../animated-number"
import type { Countdown } from "#lib/countdown"
import { LiveBadge, type LiveStatus } from "../live-badge"
import { PollCard, PollCardFooter, PollCardMeta, PollCardTitle } from "../poll-card"
import { AppHeader, PageSection, PageShell, Panel, StatTile, ViewGrid } from "../poll-surfaces"
import { ResultList, ResultSummary, type PollResult } from "../result-bar"
import { ResultDonut } from "../result-donut"
import { SegmentedControl } from "../segmented-control"
import { useCopy } from "../share-link"

/**
 * VIEW 3: live results.
 * Feed `results` from the realtime source, in the same option order every time.
 * Every change animates: bars move, numbers count, "+1" chips rise, the Leading tag moves.
 * Once `countdown.closed` the view shows final results, and the Leading tag reads Winner.
 */
type ResultsViewProps = {
  poll: { id: string; question: string; tone: Tone }
  results: PollResult[]
  myVoteId?: string
  liveStatus?: LiveStatus
  /** From the page's one clock. */
  countdown: Countdown
  /** Why voting ended (creator or timer). */
  closedText: string
  /** Open sockets on the poll. */
  viewers?: number
  shareUrl: string
  newPollLink?: React.ReactElement<{ children?: React.ReactNode }>
  header?: React.ReactNode
}

type Mode = "bars" | "chart"

function ResultsView({
  poll,
  results,
  myVoteId,
  liveStatus = "live",
  countdown,
  closedText,
  viewers = 0,
  shareUrl,
  newPollLink,
  header,
}: ResultsViewProps) {
  const [mode, setMode] = React.useState<Mode>("bars")
  const [copied, copy] = useCopy()
  const closed = countdown.closed

  const total = results.reduce((s, r) => s + r.votes, 0)
  const max = Math.max(0, ...results.map((r) => r.votes))
  const leaders = results.filter((r) => r.votes === max && max > 0)
  const leader = leaders.length === 1 ? leaders[0] : undefined
  const mine = results.find((r) => r.id === myVoteId)

  return (
    <div className="min-h-dvh bg-background text-foreground" style={toneStyle(poll.tone)}>
      {header ?? (
        <AppHeader
          actions={
            newPollLink && (
              <Button asChild variant="outline">
                {React.cloneElement(newPollLink, {}, <><Plus aria-hidden />New poll</>)}
              </Button>
            )
          }
        />
      )}

      <PageShell>
        <ViewGrid>
          <PageSection className="min-w-0 lg:col-span-7">
            <PollCard tone={poll.tone} aria-labelledby="results-question">
              <div className="flex flex-col gap-4">
                <PollCardMeta>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={closed ? "closed" : "live"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={spring.pop}
                    >
                      {closed ? (
                        <LiveBadge status="closed">Poll closed</LiveBadge>
                      ) : (
                        <LiveBadge status={liveStatus}>{liveStatus === "live" ? "Live results" : undefined}</LiveBadge>
                      )}
                    </motion.span>
                  </AnimatePresence>
                  <SegmentedControl<Mode>
                    aria-label="Result view"
                    variant="tone"
                    size="sm"
                    value={mode}
                    onValueChange={setMode}
                    items={[
                      { value: "bars", label: "Bars", icon: <AlignLeft aria-hidden /> },
                      { value: "chart", label: "Chart", icon: <ChartPie aria-hidden /> },
                    ]}
                  />
                </PollCardMeta>
                <PollCardTitle id="results-question">{poll.question}</PollCardTitle>
              </div>

              <div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {mode === "bars" ? (
                      <ResultList results={results} myVoteId={myVoteId} final={closed} />
                    ) : (
                      <ResultDonut results={results} />
                    )}
                  </motion.div>
                </AnimatePresence>
                <ResultSummary results={results} viewers={viewers} open={!closed} className="mt-5" />
              </div>

              <PollCardFooter>
                <span className="tabular-nums">
                  <AnimatedNumber value={total} fromZero={false} /> {total === 1 ? "vote" : "votes"}
                  {" · "}
                  {closed ? (
                    closedText
                  ) : (
                    <span role="timer" aria-label={`Voting closes in ${countdown.spoken}`}>
                      Closes in {countdown.label}
                    </span>
                  )}
                </span>
                <Button type="button" variant="tone-outline" size="sm" onClick={() => copy(shareUrl)}>
                  {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
                  {copied ? "Link copied" : "Share"}
                </Button>
              </PollCardFooter>
            </PollCard>
          </PageSection>

          <PageSection className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            {mine && (
              <Panel className="flex-row items-center gap-4">
                <motion.span
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring.pop, delay: 0.25 }}
                  className="grid size-12 flex-none place-items-center rounded-full bg-tone text-on-tone"
                >
                  <Check className="size-6" strokeWidth={3} aria-hidden />
                </motion.span>
                <div>
                  <div className="font-display-wide text-xl leading-[1.2]">Vote counted</div>
                  <div className="text-sm text-muted-foreground">
                    {closed
                      ? `You picked ${mine.label}. These are the final results.`
                      : `You picked ${mine.label}. Results update live.`}
                  </div>
                </div>
              </Panel>
            )}

            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Total votes" value={<AnimatedNumber value={total} />} />
              <StatTile
                label={closed ? "Winner" : "Leading"}
                value={
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={leader?.id ?? "tie"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={spring.enter}
                      className="line-clamp-2 block text-xl leading-[1.25] break-words"
                    >
                      {leader?.label ?? (total ? "Tie" : "None yet")}
                    </motion.span>
                  </AnimatePresence>
                }
                hint={leader ? <><AnimatedNumber value={leader.percent} suffix="%" /> of votes</> : undefined}
              />
            </div>
          </PageSection>
        </ViewGrid>
      </PageShell>
    </div>
  )
}

export { ResultsView }
export type { ResultsViewProps }
