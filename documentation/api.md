# API

The web pages use this same API, so you can try everything with `curl`.

## Try it

Start the app with `pnpm dev`, then run these steps. Use the port that `pnpm dev` prints.

```bash
BASE=http://localhost:5173

# Your client picks the poll ID and the admin token. Sending the same request twice is safe.
ID=$(node -e "console.log(require('crypto').randomBytes(8).toString('base64url').slice(0, 10))")
TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")

# 1. Create a poll that stays open for 15 minutes.
curl -s -X POST "$BASE/api/polls" -H 'content-type: application/json' \
  -d "{\"id\":\"$ID\",\"question\":\"Tabs or spaces?\",\"options\":[\"Tabs\",\"Spaces\"],\"durationSec\":900,\"tone\":\"flame\",\"adminToken\":\"$TOKEN\"}"

# 2. Open the vote page to get a voter cookie, then vote for answer 1.
curl -s -c jar.txt -o /dev/null "$BASE/pr/$ID"
curl -s -b jar.txt -X PUT "$BASE/api/polls/$ID/vote" -H 'content-type: application/json' -d '{"optionId":1}'

# 3. Without a vote, you can't see the counts yet ("results": null).
curl -s "$BASE/api/polls/$ID"

# 4. The creator can always see the counts, and can close the poll.
curl -s "$BASE/api/polls/$ID" -H "authorization: Bearer $TOKEN"
curl -s -X POST "$BASE/api/polls/$ID/close" -H "authorization: Bearer $TOKEN"
```

## Endpoints

| Method | Path | Who can call it | What it returns |
| --- | --- | --- | --- |
| `POST` | `/api/polls` | Anyone | 201 with the new poll. 200 if you send the same request again. 409 if the ID is taken by a different poll. 429 after 5 polls in a minute. |
| `GET` | `/api/polls/{id}` | Anyone | 200 with the poll. The counts are included only for voters, the creator, or after the poll closes. 404 if it doesn't exist. |
| `PUT` | `/api/polls/{id}/vote` | Anyone with a voter cookie | 200 with the counts. Voting the same way again changes nothing. Voting differently gets 409. 410 after the poll closes. |
| `POST` | `/api/polls/{id}/close` | The creator (`Authorization: Bearer {adminToken}`) | 200. Closing again is fine. 401 without a token, 403 with a wrong one. |
| `POST` | `/api/polls/{id}/live-ticket` | Voters and the creator | 200 with a ticket for the live connection. It works for 60 seconds. |
| `GET` | `/api/polls/{id}/live?ticket=…` | Anyone with a ticket | A WebSocket that sends the poll now and after every change. |
| `GET` | `/api/health` | Anyone | 200 when the app is running. |

## Errors

Every error looks like this, with no stack trace:

```json
{ "code": "poll_closed", "message": "This poll is closed. Here are the final results." }
```

The message always says what happened, and what to do next when there is something to do.
