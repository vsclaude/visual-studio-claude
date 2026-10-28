# vsclaude-cloud

The server behind Vey Studio: **Vey Pro**'s purchase, its licence keys and
the devices they are on, the studio's anonymous **usage counts**, and the
landing page and user's guide. What was paid and what it bought live here, in
D1. There is **no sign-in** (§ Sign-in, removed). No chat goes
through it: every turn runs on the user's own Claude accounts, straight to
Anthropic.

The app's half is `src/main/studio-server.ts`, `src/main/license.ts` and
`src/shared/license.ts` in the app's repository, and `docs/design.md` § Pro
there.

## Endpoints

| Route                          | What                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `GET /`, `/vi/`, `/docs/…`     | The home page and the user's guide: static, built from `site/` (VitePress) into `public/`.                     |
| `POST /api/license/checkout`   | `{ seats, email, device }` → `{ url }`: a bank-transfer order for Vey Pro and its `/pay` page.                 |
| `GET /api/license?device=`     | The licence a purchase on that device bought, `{ key, activation }`, once paid; 404 before; 410 if refunded.   |
| `POST /api/license/activate`   | `{ key, device }` → `{ key, activation }`: a key — or a campaign's code — put on a device; 409 seats full.     |
| `POST /api/license/deactivate` | `{ key, device }` → `204`: the device taken off the key, its seat freed.                                       |
| `GET /pay/<code>`              | The VietQR page a purchase opens.                                                                              |
| `GET /api/orders/<code>`       | Whether an order is paid, for `/pay` to poll. No token.                                                        |
| `POST /api/webhooks/sepay`     | SePay's webhook; signed or keyed, no token.                                                                    |
| `POST /api/telemetry`          | The studio's anonymous usage counts (`app_opened`, `heartbeat`) → a row of D1's `app_events`; `204`. No token. |

No route takes a token. A failure is `{ error }`, the sentence the studio
shows.

## Vey Pro

What is sold is **Vey Pro** — every project after the first, bought once by
bank transfer for one, three or five devices (`PRO_PLANS` in
`server/utils/billing.ts`; the app's `src/shared/license.ts` shows the same
prices, and `test/license.test.ts` compares them).

- `POST /api/license/checkout` `{ seats, email, device }` writes a SePay
  `Order` — the device it was opened on, the email the key goes to — whose
  code (`NITRO_SEPAY_CODE_PREFIX` and eight digits) the transfer's content
  carries, and answers with the `/pay/<code>` page. A second press within
  thirty minutes, for the same plan and email, reopens the same unpaid order.
- SePay watches the bank account and posts every incoming transfer to
  `/api/webhooks/sepay`, which finds the order by that code (SePay's `code`,
  or read out of the content when SePay found none). Paid in full, the order
  is marked paid and `grantLicense` makes its **licence key** — a row of
  `licenses`, `VEY-XXXX-XXXX-XXXX-XXXX`, with the plan's seats — puts the
  order's device on it (`activations`), and mails the key (`proEmail`). A
  short transfer is noted on the order for a human. Every delivery is
  answered `{"success": true}` — SePay retries anything else — except a bad
  signature. A key that could not be made is logged as `license_error` and
  the delivery still acknowledged.
- `GET /api/license?device=` answers `{ key, activation }` for the device's
  paid order, 404 before. A paid order with no key yet is granted there and
  then, so a webhook that marked an order paid and failed to grant heals on
  the app's next ask. The app asks while a checkout is waiting and on focus.
- `POST /api/license/activate` `{ key, device }` puts a key on another device,
  if it has a seat left — in one statement, so two at once cannot both take
  the last. It is also every licensed app's check-in at launch, idempotent for
  a device already on the key.
- `POST /api/license/deactivate` `{ key, device }` frees a device's seat.
- The **activation** is `VEY2.<payload>.<signature>`: `{ email, seats,
device, issuedAt, expiresAt }` as JSON (`expiresAt` null for one bought), base64url, and an Ed25519 signature over those
  bytes with `NITRO_LICENSE_PRIVATE_KEY` (PKCS#8 PEM). The app verifies it
  offline against the public half it ships **and** its own device id. Signing
  is WebCrypto (`crypto.subtle`), not `node:crypto`, which Cloudflare's
  runtime only partly ports; the app's `src/main/license.ts` has a Node copy
  of `signActivation`, and `test/license.test.ts` signs with this one and
  verifies with the app's.

**Refunds** (7 days, promised on the page): refund the transfer by hand, then
`UPDATE licenses SET revoked_at = '<now>' WHERE order_code = 'VSC…'` in D1. A
revoked key answers 410, and every device on it drops Pro at its next launch.

### Campaigns

A **campaign** gives Pro away for a while — a code posted somewhere, typed
into the app's `Have a key or a promo code?` field. Each device that redeems
it gets a licence of its own (a `licenses` row with `campaign` and
`expires_at`, no `order_code`), for `seats` devices, ending `months` after
**that device** redeemed it; its key comes back like a bought one, so it can
be deactivated and pasted on another machine, keeping its end. A device
redeems a campaign once (`redemptions`). Past `expires_at` the app drops to
Free on its own, offline, and `activate` answers 410 for it.

There is no admin page: a campaign is a row made in D1 —

```sql
INSERT INTO campaigns (code, months, seats, max_redemptions, ends_at, created_at)
VALUES ('VEYGIFT6M', 6, 1, 500, '2026-12-31T16:59:59Z', datetime('now'));
```

`code` is upper-case letters, digits, `-` and `_` (3–32; typed in any case);
`max_redemptions` and `ends_at` (when the code stops being redeemable, not
when its licences end) may be `NULL` for none. Closing one early is
`UPDATE campaigns SET ends_at = datetime('now') WHERE code = '…'`; licences
already given keep running. How many it has given:
`SELECT COUNT(*) FROM redemptions WHERE campaign = 'VEYGIFT6M'`.

The device id is the app's own random one, so somebody who wipes the app's
settings is a new device and can redeem again — `max_redemptions` is the cap
that holds.

### The signing key

Generating the pair, once: the app repo's `license-private-key.local.pem`
(gitignored) is the private half; its raw public key is
`LICENSE_PUBLIC_KEY` in the app. To make another:

```sh
node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ed25519');console.log(privateKey.export({type:'pkcs8',format:'pem'}));console.log(publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64'))"
```

Put the PEM in `NITRO_LICENSE_PRIVATE_KEY` (`.env`, then
`scripts/push-secrets.sh`) and the base64 line in the app's `LICENSE_PUBLIC_KEY`.
In `.env` it must be **one line**, its newlines written as `\n` —
`push-secrets.sh` reads the file a line at a time, and `pemBytes()` reads past
that, quotes and all:

```sh
printf 'NITRO_LICENSE_PRIVATE_KEY="%s"\n' "$(awk '{printf "%s", $0 "\\n"}' ../license-private-key.local.pem)" >> .env
```

Without a PEM that reads as a key — the start line says
`license_key=UNREADABLE` — `/api/license/checkout` answers 500, before anybody
pays.

## Sign-in, removed

Until 2026-10-28 the studio signed in with Google through this server
(`/signin/<nonce>`, `/signin/callback`, `/api/signin/<nonce>`,
`/api/session`, `auth.ts`, `session.ts`, `signin.ts`, `google.ts`, the
welcome mail), because Pro belonged to the Google account that paid. Pro is
per device now, carried by a key, and a sign-in for nothing else was a
browser round-trip and an OAuth client for no reason. All of it is deleted.

What is in D1 is left alone: `users` — who signed in, and the `VEY1` key the
Google era signed for them — is read by nothing and dropped by nothing; a
paid `pro` order from then still grants a one-device licence if asked, though
nothing asks. `sign_ins` is dropped: it held answers minutes old. The
`NITRO_GOOGLE_*` and `NITRO_SESSION_SECRET` variables are read by nothing.

## Credits, removed

This server was the studio's **free AI** until 2026-10-28: the studio's
`claude` was pointed here (`ANTHROPIC_BASE_URL`), and requests were forwarded
to Anthropic — through a failover list of providers in D1's `upstreams` —
and charged to credit packs bought by transfer or by Paddle card. All of it
is deleted: `/v1/messages`, `/v1/messages/count_tokens`, `/v1/models`,
`/api/usage`, `/api/orders`, `/api/hello`, the Paddle checkout, its page and
webhook, `anthropic.ts`, `upstreams.ts`, `usage.ts`, `limits.ts`,
`paddle*.ts` and their tests. Reselling the API at a thin margin was not a
business, and it was the opposite of what the studio is for: running chats on
the accounts somebody already pays for. The app's `docs/design.md`
§ Credits and the free AI, removed has the rest.

What is in D1 is left alone: `users.credits` and `users.used`, the `paddle`
rows of `transactions` and the `upstreams` table are read by nothing and
dropped by nothing. A balance somebody bought is refunded by hand. A transfer
for a credit-pack order still open grants nothing and is logged
`ignored="vnd-50k is no longer sold"`, for the same.

## Setting up

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

## Configuration

All in `nitro.config.ts` › `runtimeConfig`, overridden by environment variables
(`.env` in development):

| Variable                                                    | Default              | What                                                                                                                          |
| ----------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NITRO_LICENSE_PRIVATE_KEY`                                 | —                    | Ed25519, PKCS#8 PEM: signs Vey Pro activations. Without it `/api/license/checkout` answers 500.                               |
| `NITRO_SEPAY_BANK_ACCOUNT` / `_BANK_CODE` / `_ACCOUNT_NAME` | —                    | The account transfers go to, its SePay bank code, and its holder. Without the first two, `/api/license/checkout` answers 500. |
| `NITRO_SEPAY_CODE_PREFIX`                                   | `VSC`                | Order codes are this and eight digits.                                                                                        |
| `NITRO_SEPAY_WEBHOOK_SECRET` / `NITRO_SEPAY_API_KEY`        | —                    | The SePay webhook's HMAC secret or API key. With neither, every webhook is refused.                                           |
| `NITRO_PUBLIC_URL`                                          | the request's origin | This server's public address, for `/pay` links.                                                                               |
| `NITRO_EMAIL_FROM`                                          | —                    | The address mail is sent from (Cloudflare Email Service). Empty sends nothing.                                                |

The `NITRO_PADDLE_*` and `NITRO_MAX_PROMPT_TOKENS` variables of the free AI,
and the sign-in's `NITRO_GOOGLE_*` and `NITRO_SESSION_SECRET`, are read by
nothing. Take them out of `.env`, then `scripts/delete-secrets.sh` and
`scripts/push-secrets.sh` leave the Worker with only what is used.

## Logs

One line per request on stdout, `key=value` (`server/plugins/log.ts`), plus a
`start` line with the configuration (whether a key is set — never the key):

```
2026-10-28T03:50:01.120Z start license_key=set
2026-10-28T03:50:02.410Z request method=POST path=/api/license/checkout status=200 ms=41 order=VSC12345678 item=pro-3 amount=199000
2026-10-28T03:52:10.003Z request method=POST path=/api/webhooks/sepay status=200 ms=18 sepay=92704 amount=199000 order=VSC12345678 uid=device:6f1c… applied=pro licensed=true
2026-10-28T03:52:12.300Z request method=GET path=/api/license status=200 ms=22 order=VSC12345678 license=sent
```

A refusal says why in `refused=`. Never an email, and of a key only its last
four characters.

## Running

```bash
bun install
bun run dev               # http://localhost:3000
```

Then start the studio against it:

```bash
VEYSTUDIO_AI_URL=http://localhost:3000 bun run dev   # in the app's repository
```

(`http://` is accepted by the app for `localhost` only; anywhere else it must be
`https://`, since a licence key goes there.) The variable keeps `AI` in its
name because it is already set on the machines and the CI that build the app.

```bash
bun run test        # licence keys and activations, webhooks, mail, the page
bun run typecheck
bun run build       # the site, then the Worker
```
