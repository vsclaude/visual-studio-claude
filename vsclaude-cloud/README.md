# vsclaude-cloud

The server behind Vey Studio's **free AI**: anybody signed in to the
studio can chat on Haiku, Sonnet or Opus without a Claude account of their
own, paid for with credits they buy — there is no free allowance. The studio's
`claude` is pointed here (`ANTHROPIC_BASE_URL`) and sends an access token this
server signed when the user signed in with Google; this server checks it,
refuses a user with no credits, and forwards the request to Anthropic with its
own API key. Who the users are, what they paid and how much is left all live
here, in D1.

```
studio's claude ──(access token)──▶ vsclaude-cloud ──(server API key)──▶ api.anthropic.com
```

The app's half is `src/shared/free-ai.ts` and `src/main/free-ai.ts` in
`visual-studio-claude`, and `docs/design.md` § The free AI there.

## Endpoints

| Route                            | What                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /`, `/vi/`, `/docs/…`       | The home page and the user's guide: static, built from `site/` (VitePress) into `public/`.       |
| `POST /v1/messages`              | Passed through, streamed; charged to the user's credits.                                         |
| `POST /v1/messages/count_tokens` | Passed through; not counted (free at Anthropic).                                                 |
| `GET /v1/models`                 | The models served, in Anthropic's list shape.                                                    |
| `GET /api/usage`                 | The user's credits: `{ models, credits, creditsUsed }`.                                          |
| `POST /api/orders`               | `{ item }` → `{ url }`: a bank-transfer order and its `/pay` page.                               |
| `GET /api/orders/<code>`         | Whether an order is paid, for `/pay` to poll. No token.                                          |
| `POST /api/webhooks/sepay`       | SePay's webhook; signed or keyed, no token.                                                      |
| `GET /pay/<code>`                | The VietQR page a bank-transfer purchase opens.                                                  |
| `POST /api/checkout`             | `{ item }` → `{ url }`: a Paddle checkout carrying the uid.                                      |
| `POST /api/webhooks/paddle`      | Paddle's webhook; signed, no token.                                                              |
| `GET /checkout`                  | The page Paddle's default payment link points at: Paddle.js, and the credits card once it is in. |
| `GET /api/checkout/<txn>`        | Whether a Paddle purchase is credited and how much it added, for `/checkout` to poll. No token.  |
| `HEAD/GET /api/hello`            | The reachability probe Claude Code sends to a custom base URL.                                   |
| `GET /signin/<nonce>`            | The sign-in page the studio opens in the browser; links to Google.                               |
| `GET /signin/callback`           | Google's redirect: writes the user, keeps `{ token }` or `{ error }`.                            |
| `GET /api/signin/<nonce>`        | The studio collects that answer: `204` until there is one, then it once.                         |
| `POST /api/session`              | Session token as bearer → `{ token, expiresAt }`, an hour's access token.                        |

Every route but `/api/hello`, the webhooks, `/checkout`, `/pay`, `/api/orders/<code>`, the sign-in routes and `/api/session` needs the access token, as `Authorization: Bearer …` or
`x-api-key` (the CLI sends both). Errors are Anthropic's own shape, so the CLI
shows them as it would Anthropic's — but **never 401 or 403**, and always with
`x-should-retry: false`. Measured against the CLI: a 401/403 is read as a
credential to refresh and retried ten times over ~2.5 minutes whatever the
header says, which leaves a chat "working" on an answer that will not change.
A 400 or a 500 with the header is shown at once.

- `400 authentication_error` — no token, or not a live access token of this
  server; the message says which (expired, a session token where an access
  token belongs, or not signed with `NITRO_SESSION_SECRET`).
- `400 invalid_request_error` — a model other than the allowed ones, or no
  credits left.
- `500 api_error` — no Anthropic key configured, or Anthropic refused it (its
  own 401 is not passed on, for the reason above).
- `400 invalid_request_error`, `prompt is too long: N tokens > 100000 maximum`
  — Anthropic's own wording, which the CLI answers by compacting and retrying.
  Only a body over 100K **bytes** is counted (`count_tokens`, free), since a
  token is never less than a byte; the studio also sets the CLI's
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` to 100K, so this is the backstop.

The user's token is never forwarded; Anthropic sees only this server's key.

## What a request costs

In **input-token equivalents**: each kind of token is weighted by its price
against an uncached Haiku input token — cache writes 1.25×, cache reads 0.1×,
output 5× (`server/utils/usage.ts`) — and the whole request 5× if its prompt
passed 100K, for one let through when the count failed. Read off Anthropic's
own `usage` (streamed or not); a request cut off by Stop is still charged for
what was generated. A request that starts with credits left is finished even if
it costs more than is left; the balance stops at 0 and the next one is refused.

**Sonnet and Opus are counted at their own price** — 20× and 40× Haiku's, with
their 0.05× cache reads and no long-prompt surcharge — so a credit is the same
money whichever model spends it. An unknown model counts as Opus.

**The unit is shown as dollars.** Ten million of it are $1.00 of Anthropic's
list price (`CREDITS_PER_USD` in `usage.ts`), and that is how the studio, the
landing page and the payment pages write every balance, pack and charge —
`$1.00`, `$0.135`— never as a count. The database, the webhooks,`/api/usage`and the`usage` log line carry the integer.

## Credits

There are no plans — the monthly Starter, Plus and Pro were withdrawn. What is
sold is **credit packs**, in VND, by the app's own item ids
(`src/shared/credits.ts`), two ways:

- **Bank transfer, through SePay** — for Vietnam. `POST /api/orders` writes an
  `Order` whose code —
  `NITRO_SEPAY_CODE_PREFIX` and eight digits — the transfer's content carries,
  and answers with `/pay/<code>`. SePay watches the account and posts every
  incoming transfer to `/api/webhooks/sepay`, which finds the order by that
  code (SePay's `code`, or read out of the content when SePay found none),
  adds the pack once paid in full, notes a short transfer on the order for a
  human, and counts each SePay transaction once (`sepay:<id>`). An order for a
  plan, written before plans were withdrawn, grants nothing if paid now — that
  money is a human's to refund. Every delivery is
  answered `{"success": true}` — SePay retries anything else — except a bad
  signature.
- **Card, through Paddle** — for everywhere else, by `POST /api/checkout`;
  each pack's Paddle **price id** is configuration (`NITRO_PADDLE_PRICE_*`),
  since the sandbox and the live account have different ones. A pack with no
  price id is not on sale.

What credits pay for:

- **Every request, on every model** (`NITRO_ALLOWED_MODELS` — Haiku, Sonnet
  and Opus), at that model's price. There is no free allowance: a user with no
  credits is refused before anything is spent. (There was a daily budget per
  user once; it is withdrawn, and `./.data/quota` is not read any more.)
- `GET /api/usage` answers what is left (`credits`) and what has been spent
  (`creditsUsed`, counted as requests are charged — 0 for an account older
  than the count).
- An approved **full** Paddle refund of a pack takes back what is left of it.
  Refunding a transfer is done by hand, at the bank.
- **Paddle checkouts are created by the server** so the uid rides on them as
  `custom_data`; the webhook reads it back, and links the transaction to the
  uid for a refund, which does not carry it. A transaction whose user is not
  known yet is answered **503**, so Paddle retries it. `subscription.*` events
  are answered 200 and ignored.
- Stored in the D1 database `vsclaude` (binding `DB`, `server/utils/database.ts`):
  `users` (the balance, one row per buyer) and `transactions` (one row per
  purchase, `provider` = `paddle` or `sepay`, `status` = `pending` / `paid` /
  `refunded`), plus `sign_ins` for a sign-in's answer waiting minutes to be
  collected. No JSON in a cell. A balance only changes by a statement relative
  to what it is, and a purchase leaves `pending` in the same D1 batch that adds
  its credits, so neither a charge racing a payment nor a webhook delivered
  twice can miscount. Locally,
  Miniflare keeps the database under `.wrangler/`. Nothing earlier is carried
  over: the first request drops the tables of the layout that kept JSON.

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

1. One-time products and prices for the packs, in VND, at the prices in the
   app's `credits.ts`. Paddle's minimum charge in VND is **20,276 ₫**.
2. Checkout › Checkout configuration › **Default payment link**:
   `https://<server>/checkout`, on a domain approved under Website approval.
3. Developer tools › Authentication: an **API key** (`NITRO_PADDLE_API_KEY`)
   and a **client-side token** (`NITRO_PADDLE_CLIENT_TOKEN`).
4. Developer tools › Notifications: a destination at
   `https://<server>/api/webhooks/paddle`, its secret key in
   `NITRO_PADDLE_WEBHOOK_SECRET`, with the events `transaction.completed`,
   `adjustment.created` and `adjustment.updated`.

Sandbox cards: `4242 4242 4242 4242`, any future date, any CVC.

Setting up Google sign-in:

1. Google Cloud › APIs & Services › OAuth consent screen: the app's name, an
   External audience, and the scopes `openid`, `email`, `profile`.
2. Credentials › Create credentials › **OAuth client ID**, type **Web
   application**, with the authorized redirect URIs
   `https://<server>/signin/callback` and, for `bun run dev`,
   `http://localhost:3000/signin/callback`. Its id and secret go in
   `NITRO_GOOGLE_CLIENT_ID` and `NITRO_GOOGLE_CLIENT_SECRET`.
3. `NITRO_SESSION_SECRET`: 32 random bytes or more
   (`openssl rand -base64 48`). It signs every session; changing it signs
   everybody out.

## Configuration

All in `nitro.config.ts` › `runtimeConfig`, overridden by environment variables
(`.env` in development; see `.env.example`):

| Variable                                                         | Default                                              | What                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NITRO_ANTHROPIC_API_KEY`                                        | — (required)                                         | A Console API key. Every free request spends it.                                                                    |
| `NITRO_ALLOWED_MODELS`                                           | `claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5` | The models served, comma-separated. Keep in step with the app's `FREE_AI_MODELS`.                                   |
| `NITRO_SEPAY_BANK_ACCOUNT` / `_BANK_CODE` / `_ACCOUNT_NAME`      | —                                                    | The account transfers go to, its SePay bank code, and its holder. Without the first two, `/api/orders` answers 500. |
| `NITRO_SEPAY_CODE_PREFIX`                                        | `VSC`                                                | Order codes are this and eight digits.                                                                              |
| `NITRO_SEPAY_WEBHOOK_SECRET` / `NITRO_SEPAY_API_KEY`             | —                                                    | The SePay webhook's HMAC secret or API key. With neither, every webhook is refused.                                 |
| `NITRO_PUBLIC_URL`                                               | the request's origin                                 | This server's public address, for `/pay` links.                                                                     |
| `NITRO_PADDLE_ENVIRONMENT`                                       | `sandbox`                                            | `sandbox` or `production`; every Paddle value below belongs to that account.                                        |
| `NITRO_PADDLE_API_KEY`                                           | —                                                    | Checkouts. Without it `/api/checkout` answers 500.                                                                  |
| `NITRO_PADDLE_WEBHOOK_SECRET`                                    | —                                                    | The notification destination's secret. Without it every webhook is refused.                                         |
| `NITRO_PADDLE_CLIENT_TOKEN`                                      | —                                                    | Paddle.js's, for `/checkout`.                                                                                       |
| `NITRO_PADDLE_PRICE_CREDITS20K` / `_CREDITS60K` / `_CREDITS100K` | —                                                    | The credit packs' `pri_…` ids.                                                                                      |
| `NITRO_MAX_PROMPT_TOKENS`                                        | `100000`                                             | Largest prompt forwarded (Haiku 5.5 is 5× past 100K). `0` = no limit.                                               |
| `NITRO_GOOGLE_CLIENT_ID` / `NITRO_GOOGLE_CLIENT_SECRET`          | —                                                    | The Web application OAuth client sign-in goes through. Without them nobody can sign in.                             |
| `NITRO_SESSION_SECRET`                                           | —                                                    | Signs the session and access tokens. Without it nobody can sign in, and nothing is let through.                     |
| `NITRO_ANTHROPIC_BASE_URL`                                       | `https://api.anthropic.com`                          |                                                                                                                     |

## Logs

One line per request on stdout, `key=value` (`server/plugins/log.ts`), plus a
`start` line with the configuration (whether the key is set — never the key)
and a `usage` line when a streamed answer ends, joined to its request by `rid`:

```
2026-10-18T03:50:01.120Z start anthropic_key=set upstream=https://api.anthropic.com google_client=set session_secret=set models=claude-haiku-5-5 max_prompt_tokens=100000
2026-10-18T03:50:02.410Z request method=POST path=/v1/messages status=200 ms=812 uid=google:1043… model=claude-haiku-5-5 bytes=82422 rid=req_011… upstream_status=200
2026-10-18T03:50:04.977Z usage uid=google:1043… rid=req_011… in=12 out=180 cache_read=21000 cache_write=0 weighted=3012 credits_charged=3012 ended=done
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

- **A ceiling on the whole service.** Set a monthly spend limit on the Anthropic
  key itself in the Console — that is the hard stop.
