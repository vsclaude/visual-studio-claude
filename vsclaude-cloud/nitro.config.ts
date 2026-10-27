import { existsSync, readFileSync } from "node:fs"
import { extname, join, sep } from "node:path"

import { defineConfig } from "nitro"

/** Where `vitepress build site` writes the site (`outDir` in its config). */
const SITE = join(import.meta.dirname, "public")

/**
 * The site's pages as Cloudflare serves them: `/install` is `install.html`.
 * Workers' static assets do that themselves (`html_handling`), but the dev
 * server's static handler serves a path only with an extension or as a
 * directory's `index.html` — so every page but the two home pages was a 404
 * on reload in `bun run dev`, though a click got there through VitePress's
 * own router. Only an `.html` file already built is answered; anything else
 * goes on to the routes.
 */
function cleanUrl(event: { req: Request; url: URL }): Response | undefined {
  if (event.req.method !== "GET" && event.req.method !== "HEAD") return
  const path = decodeURI(event.url.pathname)
  if (path.endsWith("/") || extname(path)) return
  const file = join(SITE, `${path}.html`)
  if (!file.startsWith(SITE + sep) || !existsSync(file)) return
  return new Response(readFileSync(file), {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

export default defineConfig({
  preset: "cloudflare_module",
  serverDir: "./server",

  devHandlers: [{ route: "/**", middleware: true, handler: cleanUrl }],

  // Nitro's dev entry imports unstorage's `fs` driver for `server/assets`, and
  // that module calls `randomUUID()` at its top level — workerd refuses that
  // outside a handler, so the whole dev entry fails to load ("Disallowed
  // operation called within global scope"). Nothing here mounts an fs driver:
  // there are no server assets, and nothing is stored in files. The memory
  // driver stands in for it so the import no longer runs that code.
  alias: { "unstorage/drivers/fs": "unstorage/drivers/memory" },

  experimental: { database: true },

  // What people have paid for (`server/utils/accounts.ts`). Created with
  // `wrangler d1 create vsclaude`; the generated wrangler config is rewritten
  // on every build, so the binding has to live here. Locally, Miniflare keeps
  // it under `.wrangler/`.
  database: {
    default: { connector: "cloudflare-d1", options: { bindingName: "DB" } },
  },
  cloudflare: {
    wrangler: {
      d1_databases: [
        {
          binding: "DB",
          database_name: "vsclaude",
          database_id: "91126c97-849b-41f6-8719-0e2be12f688e",
        },
      ],
      // Cloudflare Email Service (`server/utils/email.ts`). Sends only once
      // the sender's domain is onboarded under Email Service › Email Sending;
      // under `nitro dev` Miniflare logs a message rather than sending it.
      send_email: [{ name: "EMAIL" }],
    },
  },

  /*
   * Every key here is overridden by `NITRO_<UPPER_SNAKE>` in the environment —
   * `.env` in development, the platform's variables in production. The
   * providers requests go to, and the credits on sale, are not here: they are
   * rows of D1's `upstreams` table (`server/utils/upstreams.ts`).
   */
  runtimeConfig: {
    /** NITRO_GOOGLE_CLIENT_ID / NITRO_GOOGLE_CLIENT_SECRET — the Web
     * application OAuth client the studio signs in through
     * (`server/utils/google.ts`). Without them nobody can sign in. */
    googleClientId: "",
    googleClientSecret: "",
    /** NITRO_SESSION_SECRET — signs the session and access tokens
     * (`server/utils/session.ts`). Long and random; changing it signs
     * everybody out. */
    sessionSecret: "",
    /** NITRO_PADDLE_ENVIRONMENT — `sandbox` or `production`. Two separate
     * Paddle accounts: every Paddle value below belongs to the one named here. */
    paddleEnvironment: "sandbox",
    /** NITRO_PADDLE_API_KEY — creates checkouts. */
    paddleApiKey: "",
    /** NITRO_PADDLE_WEBHOOK_SECRET — the secret key of the notification
     * destination pointed at `/api/webhooks/paddle`. */
    paddleWebhookSecret: "",
    /** NITRO_PADDLE_CLIENT_TOKEN — Paddle.js's, for the `/checkout` page. */
    paddleClientToken: "",
    /** NITRO_PADDLE_PRICE_<ITEM> — each item's `pri_…` id. An empty one is
     * not on sale. */
    paddlePriceVnd50k: "",
    paddlePriceVnd100k: "",
    paddlePriceVnd200k: "",
    /** NITRO_SEPAY_BANK_ACCOUNT, _BANK_CODE, _ACCOUNT_NAME — the account
     * bank transfers are paid into (the one linked in SePay), SePay's short
     * bank code for it (`qr.sepay.vn/banks.json`, e.g. `MBBank`), and the
     * holder's name shown on the `/pay` page. */
    sepayBankAccount: "",
    sepayBankCode: "",
    sepayAccountName: "",
    /** NITRO_SEPAY_CODE_PREFIX — what every order code starts with, followed
     * by eight digits. Set the same prefix in SePay's payment-code structure. */
    sepayCodePrefix: "VSC",
    /** NITRO_SEPAY_WEBHOOK_SECRET — the HMAC secret, when the webhook is set to
     * HMAC-SHA256; or NITRO_SEPAY_API_KEY, when it is set to API Key. */
    sepayWebhookSecret: "",
    sepayApiKey: "",
    /** NITRO_PUBLIC_URL — this server's own address, for the `/pay` links
     * the studio opens. Empty is the origin each request came in on. */
    publicUrl: "",
    /** NITRO_EMAIL_FROM — the address mail is sent from, on a domain onboarded
     * to Cloudflare Email Service, e.g. `Vey Studio <hello@example.com>`.
     * Empty sends nothing (`server/utils/email.ts`). */
    emailFrom: "",
    /** NITRO_MAX_PROMPT_TOKENS — the largest prompt forwarded, the studio's
     * compact window: every request of a long chat re-sends the whole prompt,
     * so a turn's price grows with it. 0 turns the check off. */
    maxPromptTokens: 100_000,
  },
})
