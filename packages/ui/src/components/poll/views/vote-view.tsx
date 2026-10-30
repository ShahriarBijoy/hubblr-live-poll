import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Plus } from "lucide-react"

import { toneStyle, type Tone } from "#lib/poll-tones"
import { spring } from "#lib/poll-motion"
import { Button } from "#components/button"
import { AnimatedNumber } from "../animated-number"
import { CountdownBadge } from "../countdown-badge"
import type { Countdown } from "#lib/countdown"
import { PollCard, PollCardFooter, PollCardMeta, PollCardTitle } from "../poll-card"
import { AppHeader, PageSection, PageShell, Panel, PanelTitle, StatTile, ViewGrid } from "../poll-surfaces"
import { ShareLink } from "../share-link"
import { VoteOptionGroup, type PollOption } from "../vote-options"

export type PollView = {
  id: string
  question: string
  options: PollOption[]
  tone: Tone
}

/**
 * VIEW 2: vote. It never receives a count per option, only the total.
 * Once `countdown.closed` the answers lock and the CTA links to the final results.
 * The server still rejects late votes; this is only the UI side.
 *
 * `resultsLink` / `newPollLink` are empty link elements the page passes in,
 * so this file has no router dependency. Their children are filled in here.
 */
type VoteViewProps = {
  poll: PollView
  totalVotes: number
  /** From the page's one clock. */
  countdown: Countdown
  /** Why voting ended (creator or timer). */
  closedText: string
  /** Line next to the button while the poll is open, e.g. how many votes so far. */
  countText: string
  /** The option this browser voted for, if any. */
  myVoteId?: string
  shareUrl: string
  onVote: (optionId: string) => void
  voting?: boolean
  error?: string | null
  resultsLink: React.ReactElement<{ children?: React.ReactNode }>
  newPollLink?: React.ReactElement<{ children?: React.ReactNode }>
  header?: React.ReactNode
}

function VoteView({
  poll,
  totalVotes,
  countdown,
  closedText,
  countText,
  myVoteId,
  shareUrl,
  onVote,
  voting = false,
  error,
  resultsLink,
  newPollLink,
  header,
}: VoteViewProps) {
  const [picked, setPicked] = React.useState<string>()
  const { closed, ending } = countdown
  const choice = picked ?? myVoteId
  const myLabel = poll.options.find((o) => o.id === myVoteId)?.label

  const hint = error
    ? error
    : closed
      ? closedText
      : myLabel
        ? `Your vote: ${myLabel}.`
        : ending
          ? "Less than a minute left. Vote now."
          : countText

  const options = (
    <motion.div animate={{ opacity: closed ? 0.55 : 1 }} transition={{ duration: 0.3 }}>
      <VoteOptionGroup options={poll.options} value={choice} onValueChange={setPicked} disabled={voting || closed} />
    </motion.div>
  )

  const actions = (
    <PollCardFooter>
      <AnimatePresence mode="popLayout" initial={false}>
        {closed ? (
          <motion.div key="final" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.enter}>
            <Button asChild variant="ink">
              {React.cloneElement(resultsLink, {}, <>See results<ArrowRight aria-hidden /></>)}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="cast" exit={{ opacity: 0, y: -6 }}>
            <Button type="submit" variant="ink" disabled={!choice || choice === myVoteId} loading={voting}>
              Vote
              <ArrowRight aria-hidden />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={hint}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={spring.enter}
          role={error ? "alert" : undefined}
          className="min-w-[12rem] flex-1 sm:text-right"
        >
          {hint}
        </motion.span>
      </AnimatePresence>
    </PollCardFooter>
  )

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
            <PollCard tone={poll.tone} aria-labelledby="poll-question">
              <div className="flex flex-col gap-4">
                <PollCardMeta>
                  <span>Anonymous poll</span>
                  <CountdownBadge countdown={countdown} closedLabel="Voting closed" />
                </PollCardMeta>
                <PollCardTitle id="poll-question">{poll.question}</PollCardTitle>
              </div>
              {closed ? (
                <>
                  {options}
                  {actions}
                </>
              ) : (
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (choice && choice !== myVoteId && !voting) onVote(choice)
                  }}
                >
                  {options}
                  {actions}
                </form>
              )}
            </PollCard>
          </PageSection>

          <PageSection className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            <Panel>
              <div className="flex flex-col gap-1">
                <PanelTitle>{closed ? "Voting has ended" : "Share this poll"}</PanelTitle>
                <p className="text-sm text-muted-foreground">
                  {closed
                    ? "This link now shows the final results."
                    : "Anyone with the link can vote until the poll closes. Voters see the results after they vote."}
                </p>
              </div>
              <ShareLink url={shareUrl} />
            </Panel>
            <div className="grid grid-cols-2 gap-4">
              <StatTile label="Votes so far" value={<AnimatedNumber value={totalVotes} />} />
              <StatTile label="Answers" value={poll.options.length} />
            </div>
          </PageSection>
        </ViewGrid>
      </PageShell>
    </div>
  )
}

export { VoteView }
export type { VoteViewProps }
