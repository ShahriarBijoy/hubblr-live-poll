# Security

There are no accounts. Instead, the app uses two secrets, and the server decides what each person may see.

## The two secrets

- **Voter cookie.** The vote page gives each browser a signed cookie with a random voter ID.
  The server signs it with `VOTER_SECRET`, so nobody can make up their own.
  It is `HttpOnly`, `Secure`, and `SameSite=Lax`, and lasts 30 days.
- **Admin token.** The creator's browser makes a random 256-bit token and puts it after the `#` in the admin link.
  Browsers never send the part after `#` to a server, so it stays out of logs.
  The page sends it only in an `Authorization` header. The server stores just a hash of it.

The live connection also needs a short ticket. Only voters and the creator can get one, and it works for 60 seconds.

## What could go wrong, and what stops it

| Risk | What stops it | What is left |
| --- | --- | --- |
| Someone closes your poll | Closing needs the admin token: 256 random bits, stored as a hash, compared in constant time | Anyone you give the admin link to can close it. The manage page warns you. |
| The admin link ends up in logs | The token is after the `#`, and request logging is turned off | You could paste the link somewhere by mistake |
| Someone sees the results before voting | The server removes the counts from every answer they may not see, and the live connection needs a voter's ticket | Low |
| Someone votes twice | One vote per signed cookie, plus a rate limit per voter and IP | Clearing cookies gives a new voter. The next step would be Cloudflare Turnstile. |
| Another site makes you vote (CSRF) | The cookie is `SameSite=Lax`, and a vote is a JSON `PUT` that other sites can't send | Low |
| Another site opens your live connection | It needs a ticket from this site, and the server checks where the request came from | A ticket can be reused during its 60 seconds, but getting one needs a vote. Low. |
| Someone puts a script in a poll question | React escapes all text, and a strict Content Security Policy blocks unknown scripts | Low |
| Someone guesses poll IDs | Each ID has 60 random bits | Low |
| Another site shows this app in a frame | The policy forbids framing | Low |
| Huge or broken requests | Bodies over 4 KB are refused, and every field has a length limit | Low |
| Errors reveal how the app works | Errors are a code and a short message, never a stack trace | Low |
| Old poll links stay open | Polls close within 24 hours and are deleted 7 days later | Final results stay public for those 7 days |
| The summary table keeps personal data | It only keeps counts and times. No questions, no answers, no voter IDs. | Low |
| A pull request steals the Cloudflare token | Pull requests from forks don't get the token, and only the owner can push branches | A collaborator with write access could read it |

## Security headers

Every page is sent with these headers:

- `Content-Security-Policy`: only this site's own scripts (with a new random nonce each time), no framing
- `Strict-Transport-Security`: HTTPS only
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`: no camera, microphone, or location
- `Cross-Origin-Opener-Policy: same-origin`

The fonts are bundled with the app, so the policy doesn't need to trust any font server.

## Rate limits

| What | Limit |
| --- | --- |
| Creating polls | 5 per minute per IP |
| Voting | 20 per 10 seconds per voter and IP |
| Closing | 10 per minute per IP |

Cloudflare counts these per data center, and the counts are approximate. A very fast burst can get a few extra requests through.

## Checked

On 2026-10-30, every row above was checked against the live site, with a real request or by reading the code.
Every header matched. `pnpm audit --prod` found no problems.
The full `pnpm audit` lists 9 issues, all in test tools that are never deployed.
