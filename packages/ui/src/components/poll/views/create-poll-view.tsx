import type * as React from "react"

import { PollComposer, type PollComposerProps } from "../poll-composer"
import { AppHeader, PageShell, PageSection, PageTitle } from "../poll-surfaces"

/**
 * VIEW 1: create a poll. Props-only: the page owns the request and the navigation.
 */
type CreatePollViewProps = Omit<PollComposerProps, "className" | "defaultValue"> & {
  title: React.ReactNode
  description?: React.ReactNode
  /** Override the default header. */
  header?: React.ReactNode
}

function CreatePollView({ title, description, header, ...composer }: CreatePollViewProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {header ?? <AppHeader />}
      <PageShell>
        <PageSection>
          <PageTitle title={title} description={description} />
        </PageSection>
        <PollComposer {...composer} />
      </PageShell>
    </div>
  )
}

export { CreatePollView }
export type { CreatePollViewProps }
