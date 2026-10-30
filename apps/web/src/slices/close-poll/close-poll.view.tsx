import { statusAt, type PollSnapshot, type Tone } from "@poll-request/domain";
import { Button } from "@poll-request/ui/components/button";
import { toneStyle } from "@poll-request/ui/lib/poll-tones";
import { LiveBadge, type LiveStatus } from "@poll-request/ui/poll/live-badge";
import { PollCard, PollCardFooter, PollCardMeta, PollCardTitle } from "@poll-request/ui/poll/poll-card";
import { PanelSkeleton, PollCardSkeleton } from "@poll-request/ui/poll/poll-skeleton";
import { AppHeader, NewPollButton, PageSection, PageShell, PageTitle, Panel, PanelTitle, ViewGrid } from "@poll-request/ui/poll/poll-surfaces";
import { ResultList, ResultSummary } from "@poll-request/ui/poll/result-bar";
import { ShareLink } from "@poll-request/ui/poll/share-link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLivePoll, type LiveState } from "../../platform/live-poll";
import { CLOSED_TEXT, PollNotFound, pollCountdown, useServerClock } from "../../platform/poll-page";
import { resultRows } from "../../platform/result-rows";
import { manageLinks, manageQuery, mergeManageSnapshot, sendClose, type ManageLinks } from "./close-poll.manage";

const OPEN_TITLE = "Your poll is live.";
const CLOSED_TITLE = "Your poll is closed.";
const OPEN_DESCRIPTION = "Send the voting link to voters. Keep the admin link to yourself.";
const CLOSED_DESCRIPTION = "Voting has ended. The voting link now shows the final results.";

const LIVE_STATUS: Record<LiveState, LiveStatus> = { connecting: "connecting", live: "live", stopped: "offline" };

function subscribeToLocation(onChange: () => void): () => void {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
}

export function ManageView({ pollId }: { pollId: string }) {
	// The token lives in the URL fragment, which the server never receives. The server render and hydration
	// therefore see no location (null), and the page appears on the first client render after that.
	const href = useSyncExternalStore(
		subscribeToLocation,
		() => window.location.href,
		() => null,
	);
	const links = href === null ? null : manageLinks(href, pollId);

	if (links !== null) return <ManagePanel key={links.authorization} pollId={pollId} links={links} />;
	return (
		<ManagePage title={OPEN_TITLE}>
			{href === null ? (
				<ManageSkeleton side={<><PanelSkeleton /><PanelSkeleton /></>} />
			) : (
				<Panel className="max-w-xl">
					<p role="alert" className="text-sm text-danger-soft">
						This admin link is incomplete. Open the full link you saved, including the part after the #.
					</p>
				</Panel>
			)}
		</ManagePage>
	);
}

function ManagePanel({ pollId, links }: { pollId: string; links: ManageLinks }) {
	const { authorization } = links;
	// Stable, so onSnapshot keeps its identity and the live connection does not reopen on each render.
	const query = useMemo(() => manageQuery(pollId, authorization), [pollId, authorization]);
	const { data } = useQuery(query);
	const queryClient = useQueryClient();
	const onSnapshot = useCallback(
		(snapshot: PollSnapshot) => {
			queryClient.setQueryData(query.queryKey, (current) => mergeManageSnapshot(current, snapshot));
		},
		[queryClient, query.queryKey],
	);
	const live = useLivePoll(pollId, onSnapshot, { authorization, enabled: data?.status.kind === "open" });

	if (data === null) return <PollNotFound />;
	if (data === undefined) {
		return (
			<ManagePage title={OPEN_TITLE}>
				<ManageSkeleton side={<LinkPanels links={links} />} />
			</ManagePage>
		);
	}
	return (
		<ManageResults
			pollId={pollId}
			snapshot={data}
			links={links}
			liveStatus={LIVE_STATUS[live]}
			onSnapshot={onSnapshot}
		/>
	);
}

type ManagePageProps = { title: string; description?: string; tone?: Tone; children?: ReactNode };

function ManagePage({ title, description = OPEN_DESCRIPTION, tone, children }: ManagePageProps) {
	return (
		<div className="min-h-dvh bg-background text-foreground" style={toneStyle(tone)}>
			<AppHeader actions={<NewPollButton />} />
			<PageShell>
				<PageSection>
					<PageTitle title={title} description={description} />
				</PageSection>
				{children}
			</PageShell>
		</div>
	);
}

// The results card while the poll loads, beside what the side column can already show.
function ManageSkeleton({ side }: { side: ReactNode }) {
	return (
		<ViewGrid role="status">
			<span className="sr-only">Loading the poll</span>
			<PollCardSkeleton className="min-w-0 lg:col-span-7" />
			<div className="flex min-w-0 flex-col gap-4 lg:col-span-5">{side}</div>
		</ViewGrid>
	);
}

type ManageResultsProps = {
	pollId: string;
	snapshot: PollSnapshot;
	links: ManageLinks;
	liveStatus: LiveStatus;
	onSnapshot: (snapshot: PollSnapshot) => void;
};

function ManageResults({ pollId, snapshot, links, liveStatus, onSnapshot }: ManageResultsProps) {
	const now = useServerClock(snapshot.serverNow);
	const status = statusAt(snapshot.status, now);
	const open = status.kind === "open";
	const counts = snapshot.results?.counts ?? null;
	const results = counts === null ? null : resultRows(snapshot.options, counts);

	return (
		<ManagePage
			title={open ? OPEN_TITLE : CLOSED_TITLE}
			description={open ? OPEN_DESCRIPTION : CLOSED_DESCRIPTION}
			tone={snapshot.tone}
		>
			<ViewGrid>
				<PageSection className="min-w-0 lg:col-span-7">
					<PollCard tone={snapshot.tone} aria-labelledby="manage-question">
						<div className="flex flex-col gap-4">
							<PollCardMeta>
								<LiveBadge status={open ? liveStatus : "closed"}>{open ? undefined : "Poll closed"}</LiveBadge>
							</PollCardMeta>
							<PollCardTitle id="manage-question">{snapshot.question}</PollCardTitle>
						</div>
						{results === null ? null : (
							<div>
								<ResultList results={results} final={!open} />
								<ResultSummary results={results} viewers={snapshot.viewers} open={open} className="mt-5" />
							</div>
						)}
						<PollCardFooter>
							<span className="tabular-nums">
								{snapshot.totalVotes} {snapshot.totalVotes === 1 ? "vote" : "votes"}
								{" · "}
								{open ? `Closes in ${pollCountdown(status, now).label}` : CLOSED_TEXT[status.closedBy]}
							</span>
						</PollCardFooter>
					</PollCard>
				</PageSection>
				<PageSection className="flex min-w-0 flex-col gap-4 lg:col-span-5">
					{open ? <CloseControl pollId={pollId} authorization={links.authorization} onClosed={onSnapshot} /> : null}
					<LinkPanels links={links} />
				</PageSection>
			</ViewGrid>
		</ManagePage>
	);
}

type CloseControlProps = { pollId: string; authorization: string; onClosed: (snapshot: PollSnapshot) => void };

function CloseControl({ pollId, authorization, onClosed }: CloseControlProps) {
	const [confirming, setConfirming] = useState(false);
	const close = useMutation({
		mutationFn: () => sendClose(pollId, authorization),
		onSuccess: onClosed,
		onSettled: () => setConfirming(false),
	});

	return (
		<Panel>
			<div className="flex flex-col gap-1">
				<PanelTitle>Close the poll</PanelTitle>
				<p className="text-sm text-muted-foreground">Voting stops for everyone, and everyone sees the final results.</p>
			</div>
			<div className="flex flex-wrap gap-3">
				{confirming ? (
					<>
						<Button type="button" variant="destructive" loading={close.isPending} onClick={() => close.mutate()}>
							Close it now
						</Button>
						<Button type="button" variant="outline" disabled={close.isPending} onClick={() => setConfirming(false)}>
							Cancel
						</Button>
					</>
				) : (
					<Button type="button" onClick={() => setConfirming(true)}>
						Close poll
					</Button>
				)}
			</div>
			{close.isError ? (
				<p role="alert" className="text-sm text-danger-soft">
					{close.error.message}
				</p>
			) : null}
		</Panel>
	);
}

function LinkPanels({ links }: { links: ManageLinks }) {
	return (
		<>
			<Panel>
				<div className="flex flex-col gap-1">
					<PanelTitle>Voting link</PanelTitle>
					<p className="text-sm text-muted-foreground">Anyone with this link can vote.</p>
				</div>
				<ShareLink url={links.publicUrl} />
			</Panel>
			<Panel>
				<div className="flex flex-col gap-1">
					<PanelTitle>Admin link</PanelTitle>
					<p className="text-sm text-muted-foreground">Open this page again later from this link.</p>
				</div>
				<ShareLink url={links.manageUrl} />
				<div role="note" className="rounded-[20px] bg-danger-soft/12 px-4 py-3 text-sm text-danger-soft">
					<p className="font-semibold">Keep this link private.</p>
					<p>Anyone with it can close your poll.</p>
				</div>
			</Panel>
		</>
	);
}
