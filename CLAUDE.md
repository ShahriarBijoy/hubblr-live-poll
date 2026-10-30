# CLAUDE.md

Live Poll is a real-time poll app: create a poll, share a link, watch votes arrive live.
TanStack Start (React 19, TypeScript) on one Cloudflare Worker, one Durable Object per poll, D1 for KPI summaries.

## Run it

No Cloudflare account, login, or API key is needed to run or test locally.
Never run `wrangler login`, never ask for a token, and never deploy.

```bash
pnpm install
pnpm dev            # http://localhost:5173 (or the next free port). Writes apps/web/.dev.vars on first run.
pnpm check:slices   # architecture rules, see below
pnpm typecheck
pnpm test           # Vitest; apps/web runs inside workerd via @cloudflare/vitest-pool-workers
pnpm build
```

CI runs `check:slices`, `typecheck`, `test`, and `pnpm audit --prod --audit-level high` on every pull request.
Run the first three before every commit.
On Windows, keep the clone path short (under about 120 characters), or the local D1 database fails to open.

## Layout

```
packages/domain/     Pure rules, no I/O: poll status, vote decision, count visibility, tally. Imports only zod.
packages/ui/         Design system. Components and the three poll views take props and render; no data fetching.
apps/web/src/
  slices/<use-case>/ create-poll, cast-vote, view-results, live-results, close-poll
  poll-room/         PollRoom Durable Object and its SQLite repository
  platform/          Shared plumbing: signed cookie, rate limits, security headers, live socket client
  routes/            Thin TanStack routes; each one hands off to a single slice
```

`documentation/` explains the product, API, security model, and scaling for people. Keep it in step when behavior changes.

File suffixes inside a slice: `.handler` is the REST endpoint, `.room` is the PollRoom method, `.schema` parses input,
`.query` holds TanStack Query options, `.form` holds client-side form state, `.view` and `.card` render the page.

`pnpm check:slices` enforces three rules:
- A slice never imports another slice. Shared code goes to `platform/` or `packages/domain`.
- `packages/domain` imports only zod and itself.
- A route imports from one slice only.

## Rules the code relies on

- The domain decides, the slices carry the decision. Put business rules in `packages/domain` with a test.
- Each PollRoom handles one request at a time. Keep each read, decision, and write before the first `await`.
- The server hides counts the viewer may not see. The vote view never receives per-option counts.
- Percents come from the domain `tally` (via `platform/result-rows.ts`), so every view rounds the same way.
- No direct `useEffect`. Use derived state, event handlers, `useSyncExternalStore`, or TanStack Query.
- Server HTML and the first client render must match. Read the clock through `useServerClock`.
- The Content Security Policy is strict: no inline scripts, no external fonts, scripts, or styles.
- Never log the `Authorization` header or the admin token. Workers invocation logs stay off for that reason.
- Dependencies are pinned to exact versions.
- UI copy is plain and says what happens. All poll screens use `PollCard` and the shared spacing in `poll-surfaces.tsx`.

## Style

Match the file you are in. `apps/web` and `packages/domain` use tabs, double quotes, and semicolons.
`packages/ui` uses two spaces and no semicolons.
Comments explain a non-obvious why, not what the code does.
Tests assert behavior a user or caller can observe.
Commits use conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`), one concern per commit.
