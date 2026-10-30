# Deploy

You only need a Cloudflare account to put the app online. Running it locally needs nothing.

## Deploy by hand

```bash
npx wrangler login
pnpm --filter @poll-request/web exec wrangler secret put VOTER_SECRET
pnpm run deploy
```

- When wrangler asks for the secret, paste 32 or more random characters. It signs the voter cookies.
- Wrangler refuses to deploy without the secret, so the app can never run without it.
- Type `pnpm run deploy`, not `pnpm deploy`. `pnpm deploy` is a different, built-in pnpm command.

## Automatic deploys

GitHub Actions does this for you:

- **Every pull request** runs the checks (`check:slices`, `typecheck`, `test`, and a security audit) and gets its own test copy of the app at `poll-request-pr-{number}`, with its own database.
- **Merging to `main`** deploys to production and deletes the pull request's test copy.
