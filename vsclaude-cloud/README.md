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

| Route                            | What                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/messages`              | Passed through, streamed; counted against the user's budget.                                                                |
| `POST /v1/messages/count_tokens` | Passed through; not counted (free at Anthropic).                                                                            |
| `GET /v1/models`                 | The allowed models, in Anthropic's list shape.                                                                              |
| `GET /api/usage`                 | The user's plan and day: `{ plan, models, spent, budget, utilization, resetsAt, credits, subscribed, cancelsAt, prepaid }`. |
| `POST /api/orders`               | `{ item }` → `{ url }`: a bank-transfer order and its `/pay` page.                                                          |
| `GET /api/orders/<code>`         | Whether an order is paid, for `/pay` to poll. No token.                                                                     |
| `POST /api/webhooks/sepay`       | SePay's webhook; signed or keyed, no token.                                                                                 |
| `GET /pay/<code>`                | The VietQR page a bank-transfer purchase opens.                                                                             |
| `POST /api/checkout`             | `{ item }` → `{ url }`: a Paddle checkout carrying the uid.                                                                 |
| `POST /api/portal`               | → `{ url }`: Paddle's customer portal for the user's plan.                                                                  |
| `POST /api/webhooks/paddle`      | Paddle's webhook; signed, no token.                                                                                         |
| `GET /checkout`                  | The page Paddle's default payment link points at: Paddle.js, nothing else.                                                  |
| `HEAD/GET /api/hello`            | The reachability probe Claude Code sends to a custom base URL.                                                              |

Every route but `/api/hello`, the webhooks, `/checkout`, `/pay` and `/api/orders/<code>` needs the token, as `Authorization: Bearer …` or
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

**Sonnet and Opus are counted at their own price** — 20× and 40× Haiku's, with
their 0.05× cache reads and no long-prompt surcharge — so a plan's budget is
the same money whichever model spends it. An unknown model counts as Opus.

## Plans and credits

Sold two ways, in VND, by the app's own item ids (`src/shared/plans.ts`):

- **Bank transfer, through SePay** — for Vietnam. A VietQR transfer, so
  nothing renews: a plan is bought for **1, 3 or 12 months up front**
  (`plus-3m`; twelve cost ten), and buying again extends it. Another plan
  bought while one runs starts now, with the days left carried over **by
  value** (`addPrepaid`). `POST /api/orders` writes an `Order` whose code —
  `NITRO_SEPAY_CODE_PREFIX` and eight digits — the transfer's content carries,
  and answers with `/pay/<code>`. SePay watches the account and posts every
  incoming transfer to `/api/webhooks/sepay`, which finds the order by that
  code (SePay's `code`, or read out of the content when SePay found none),
  grants it once paid in full, notes a short transfer on the order for a human,
  and counts each SePay transaction once (`sepay:<id>`). Every delivery is
  answered `{"success": true}` — SePay retries anything else — except a bad
  signature.
- **Card, through Paddle** — for everywhere else. A monthly subscription
  (`plus`) or a pack, by `POST /api/checkout`; each item's Paddle **price id**
  is configuration (`NITRO_PADDLE_PRICE_*`), since the sandbox and the live
  account have different ones. An item with no price id is not on sale.

One plan at a time, from one side: a card plan is refused while a transfer's
months run, and the reverse, since either would be paying twice for the same
days. The better of the two is what a request runs on (`planOf`).

- **A plan** (`hobby` without one) sets the day's budget
  (`NITRO_*_DAILY_BUDGET`) and adds models to `NITRO_ALLOWED_MODELS`: Plus
  Sonnet, Pro Sonnet and Opus. A card subscription grants it while `active`,
  `trialing` or `past_due` (a cancellation at the end of the period stays
  `active` until then); a transfer's plan until its date.
- **Credits** are drawn only past the day's budget, for the part past it, and
  a request is refused only once both are gone. An approved **full** Paddle
  refund of a pack takes back what is left of it. Refunding a transfer is done
  by hand, at the bank.
- **Paddle checkouts are created by the server** so the uid rides on them as
  `custom_data`; the webhook reads it back, and links the transaction and
  subscription to the uid for the events that do not carry it. An event whose
  user is not known yet is answered **503**, so Paddle retries it. Changing a
  card plan is the customer portal's (`POST /api/portal`).
- Stored under the `accounts` mount (`./.data/accounts`). This is what people
  paid for: on a platform whose disk does not survive a deploy, give it a
  persistent driver **before** taking a payment.

Setting up SePay:

1. Link the bank account at my.sepay.vn; put its number, SePay bank code and
   holder's name in `NITRO_SEPAY_BANK_ACCOUNT`, `_BANK_CODE`, `_ACCOUNT_NAME`.
2. Company › General configuration › **Payment code structure**: the prefix
   `VSC` (`NITRO_SEPAY_CODE_PREFIX`) followed by 8 digits.
3. A webhook at `https://<server>/api/webhooks/sepay`, incoming transfers,
   authenticated by HMAC-SHA256 (`NITRO_SEPAY_WEBHOOK_SECRET`) or API Key
   (`NITRO_SEPAY_API_KEY`).
4. `NITRO_PUBLIC_URL` if the server sits behind a proxy, so `/pay` links point
   at its public address.

Setting up Paddle — **once in the sandbox, again in the live account**:

1. Products and prices, in VND, at the prices in the app's `plans.ts`. Paddle's
   minimum charge in VND is **20,276 ₫**.
2. Checkout › Checkout configuration › **Default payment link**:
   `https://<server>/checkout`, on a domain approved under Website approval.
3. Developer tools › Authentication: an **API key** (`NITRO_PADDLE_API_KEY`)
   and a **client-side token** (`NITRO_PADDLE_CLIENT_TOKEN`).
4. Developer tools › Notifications: a destination at
   `https://<server>/api/webhooks/paddle`, its secret key in
   `NITRO_PADDLE_WEBHOOK_SECRET`, with the events `subscription.*`,
   `transaction.completed`, `adjustment.created` and `adjustment.updated`.

Sandbox cards: `4242 4242 4242 4242`, any future date, any CVC.

## Configuration

All in `nitro.config.ts` › `runtimeConfig`, overridden by environment variables
(`.env` in development; see `.env.example`):

| Variable                                                         | Default                              | What                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `NITRO_ANTHROPIC_API_KEY`                                        | — (required)                         | A Console API key. Every free request spends it.                                                                    |
| `NITRO_ALLOWED_MODELS`                                           | `claude-haiku-5-5`                   | Comma-separated. Keep in step with the app's `FREE_AI_MODEL`.                                                       |
| `NITRO_DAILY_BUDGET`                                             | `2000000`                            | Hobby, per user per day, input-token equivalents. `0` = no limit.                                                   |
| `NITRO_STARTER_DAILY_BUDGET` / `_PLUS_` / `_PRO_`                | `10000000` / `30000000` / `60000000` | The paid plans' days, same units.                                                                                   |
| `NITRO_SEPAY_BANK_ACCOUNT` / `_BANK_CODE` / `_ACCOUNT_NAME`      | —                                    | The account transfers go to, its SePay bank code, and its holder. Without the first two, `/api/orders` answers 500. |
| `NITRO_SEPAY_CODE_PREFIX`                                        | `VSC`                                | Order codes are this and eight digits.                                                                              |
| `NITRO_SEPAY_WEBHOOK_SECRET` / `NITRO_SEPAY_API_KEY`             | —                                    | The SePay webhook's HMAC secret or API key. With neither, every webhook is refused.                                 |
| `NITRO_PUBLIC_URL`                                               | the request's origin                 | This server's public address, for `/pay` links.                                                                     |
| `NITRO_PADDLE_ENVIRONMENT`                                       | `sandbox`                            | `sandbox` or `production`; every Paddle value below belongs to that account.                                        |
| `NITRO_PADDLE_API_KEY`                                           | —                                    | Checkouts and portal sessions. Without it both answer 500.                                                          |
| `NITRO_PADDLE_WEBHOOK_SECRET`                                    | —                                    | The notification destination's secret. Without it every webhook is refused.                                         |
| `NITRO_PADDLE_CLIENT_TOKEN`                                      | —                                    | Paddle.js's, for `/checkout`.                                                                                       |
| `NITRO_PADDLE_PRICE_STARTER` / `_PLUS` / `_PRO`                  | —                                    | The plans' `pri_…` ids.                                                                                             |
| `NITRO_PADDLE_PRICE_CREDITS20K` / `_CREDITS60K` / `_CREDITS100K` | —                                    | The credit packs' `pri_…` ids.                                                                                      |
| `NITRO_MAX_PROMPT_TOKENS`                                        | `100000`                             | Largest prompt forwarded (Haiku 5.5 is 5× past 100K). `0` = no limit.                                               |
| `NITRO_FIREBASE_PROJECT_ID`                                      | `simm-chat`                          | The project the studio signs in to.                                                                                 |
| `NITRO_ANTHROPIC_BASE_URL`                                       | `https://api.anthropic.com`          |                                                                                                                     |
| `NITRO_FIREBASE_JWKS_URL`                                        | Google's                             | Only for a test that signs its own tokens.                                                                          |

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
bun run test        # token checks, model check, usage counting, webhooks
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
