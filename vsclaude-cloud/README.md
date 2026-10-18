# vsclaude-cloud

The server behind Visual Studio Claude's **free AI**: anybody signed in to the
studio can chat on Haiku without a Claude account of their own. The studio's
`claude` is pointed here (`ANTHROPIC_BASE_URL`) and sends the user's Firebase ID
token; this server checks it, holds the request to the allowed model and the
user's daily budget, and forwards it to Anthropic with its own API key.

```
studio's claude ──(Firebase ID token)──▶ vsclaude-cloud ──(server API key)──▶ api.anthropic.com
```

The app's half is `src/shared/free-ai.ts` and `src/main/free-ai.ts` in
`visual-studio-claude`, and `docs/design.md` § The free AI there.

## Endpoints

| Route                                | What                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `POST /v1/messages`                  | Passed through, streamed; counted against the user's budget.          |
| `POST /v1/messages/count_tokens`     | Passed through; not counted (free at Anthropic).                       |
| `GET /v1/models`                     | The allowed models, in Anthropic's list shape.                         |
| `GET /api/usage`                     | The signed-in user's spend today: `{ spent, budget, utilization, resetsAt }`. |
| `HEAD/GET /api/hello`                | The reachability probe Claude Code sends to a custom base URL.         |

Every route but `/api/hello` needs the token, as `Authorization: Bearer …` or
`x-api-key` (the CLI sends both). Errors are Anthropic's own shape, so the CLI
shows them as it would Anthropic's — but **never 401 or 403**, and always with
`x-should-retry: false`. Measured against the CLI: a 401/403 is read as a
credential to refresh and retried ten times over ~2.5 minutes whatever the
header says, which leaves a chat "working" on an answer that will not change.
A 400 or a 500 with the header is shown at once.

- `400 authentication_error` — no token, or not a live ID token of the project;
  the message says which (expired, another project, not signed by Firebase, or
  issued in the future — this server's clock is wrong).
- `400 invalid_request_error` — a model other than the allowed ones.
- `500 api_error` — no Anthropic key configured, or Anthropic refused it (its
  own 401 is not passed on, for the reason above).
- `400 invalid_request_error`, `prompt is too long: N tokens > 100000 maximum`
  — Anthropic's own wording, which the CLI answers by compacting and retrying.
  Only a body over 100K **bytes** is counted (`count_tokens`, free), since a
  token is never less than a byte; the studio also sets the CLI's
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` to 100K, so this is the backstop.
- `429 rate_limit_error` + `retry-after` — today's budget is spent.

The user's token is never forwarded; Anthropic sees only this server's key.

## The budget

Per user per UTC day, in **input-token equivalents**: each kind of token is
weighted by its price against an uncached input token — cache writes 1.25×,
cache reads 0.1×, output 5× (`server/utils/usage.ts`) — and the whole request
5× if its prompt passed 100K, for one let through when the count failed. So
2,000,000 is at most **$0.20 per user per day** on Haiku 5.5. Read off Anthropic's own
`usage` (streamed or not); a request cut off by Stop is still counted for what
was generated. A request running when the budget runs out is finished; the next
one is refused.

Stored under the `quota` mount, `./.data/quota` on the server's disk by default.
That is right for **one instance**. Behind a load balancer, point it at a shared
driver (Redis, Upstash, Cloudflare KV — see `nitro.config.ts`), or every
instance counts its own share of a user's day.

## Configuration

All in `nitro.config.ts` › `runtimeConfig`, overridden by environment variables
(`.env` in development; see `.env.example`):

| Variable                    | Default             | What                                                   |
| --------------------------- | ------------------- | ------------------------------------------------------ |
| `NITRO_ANTHROPIC_API_KEY`   | — (required)        | A Console API key. Every free request spends it.       |
| `NITRO_ALLOWED_MODELS`      | `claude-haiku-5-5`  | Comma-separated. Keep in step with the app's `FREE_AI_MODEL`. |
| `NITRO_DAILY_BUDGET`        | `2000000`           | Per user per day, input-token equivalents. `0` = no limit. |
| `NITRO_MAX_PROMPT_TOKENS`   | `100000`            | Largest prompt forwarded (Haiku 5.5 is 5× past 100K). `0` = no limit. |
| `NITRO_FIREBASE_PROJECT_ID` | `simm-chat`         | The project the studio signs in to.                    |
| `NITRO_ANTHROPIC_BASE_URL`  | `https://api.anthropic.com` |                                                |
| `NITRO_FIREBASE_JWKS_URL`   | Google's            | Only for a test that signs its own tokens.             |

## Logs

One line per request on stdout, `key=value` (`server/plugins/log.ts`), plus a
`start` line with the configuration (whether the key is set — never the key)
and a `usage` line when a streamed answer ends, joined to its request by `rid`:

```
2026-10-18T03:50:01.120Z start anthropic_key=set upstream=https://api.anthropic.com firebase_project=simm-chat models=claude-haiku-5-5 daily_budget=2000000 max_prompt_tokens=100000
2026-10-18T03:50:02.410Z request method=POST path=/v1/messages status=200 ms=812 uid=Xy12… model=claude-haiku-5-5 bytes=82422 rid=req_011… upstream_status=200
2026-10-18T03:50:04.977Z usage uid=Xy12… rid=req_011… in=12 out=180 cache_read=21000 cache_write=0 weighted=3012 spent_today=3012 budget=2000000 ended=done
2026-10-18T03:51:10.003Z request method=POST path=/v1/messages status=400 ms=2 refused="the token has expired"
```

A refusal says why in `refused=`; Anthropic's own errors in `upstream_error=`.
The uid, not the email, and never a token.

## Running

```bash
bun install
cp .env.example .env      # and fill in the API key
bun run dev               # http://localhost:3000
```

Then start the studio against it:

```bash
VSCLAUDE_AI_URL=http://localhost:3000 bun run dev   # in visual-studio-claude
```

(`http://` is accepted by the app for `localhost` only; anywhere else it must be
`https://`, since the user's token goes there on every request.)

```bash
bun run test        # token checks, model check, usage counting
bun run typecheck
bun run build       # .output/server/index.mjs — `node .output/server/index.mjs`
```

Deploy with any [Nitro preset](https://nitro.build/deploy). The response streams,
so the platform must not buffer responses, and its request timeout has to
outlast a long turn (several minutes).

## Not done yet

- **Abuse beyond the budget.** One Google account is one budget; nothing stops
  somebody making many. Consider requiring a verified email, rate-limiting new
  accounts, or Firebase App Check.
- **A ceiling on the whole service.** Set a monthly spend limit on the Anthropic
  key itself in the Console — that is the hard stop.
- **Usage in the studio.** `GET /api/usage` is there; the app does not draw it
  yet.
