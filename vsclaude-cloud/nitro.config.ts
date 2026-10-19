import { defineConfig } from "nitro"

export default defineConfig({
  preset: "cloudflare_module",
  serverDir: "./server",

  // The `accounts` mount below reads this namespace. Created with
  // `wrangler kv namespace create ACCOUNTS`; the generated wrangler config is
  // rewritten on every build, so the binding has to live here.
  cloudflare: {
    wrangler: {
      kv_namespaces: [
        { binding: "ACCOUNTS", id: "7ee39cd4bba7416f83d35d326d96c122" },
      ],
    },
  },

  /*
   * Every key here is overridden by `NITRO_<UPPER_SNAKE>` in the environment —
   * `.env` in development, the platform's variables in production. Only the
   * Anthropic key has no usable default.
   */
  runtimeConfig: {
    /** NITRO_ANTHROPIC_API_KEY — a Console key; every free request spends it. */
    anthropicApiKey: "",
    /** NITRO_ANTHROPIC_BASE_URL */
    anthropicBaseUrl: "https://api.anthropic.com",
    /** NITRO_FIREBASE_PROJECT_ID — the project the studio signs in to
     * (`FIREBASE_CONFIG` in the app's `src/shared/firebase.ts`). */
    firebaseProjectId: "simm-chat",
    /** NITRO_FIREBASE_JWKS_URL — the keys ID tokens are checked against.
     * Empty is Google's own; set only for a test that signs its own tokens. */
    firebaseJwksUrl: "",
    /** NITRO_ALLOWED_MODELS — comma-separated; the app's `FREE_AI_MODELS`.
     * Every one runs on credits, each at its own price
     * (`server/utils/usage.ts`). */
    allowedModels: "claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5",
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
    paddlePriceCredits20k: "",
    paddlePriceCredits60k: "",
    paddlePriceCredits100k: "",
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
    /** NITRO_MAX_PROMPT_TOKENS — the largest prompt forwarded. 100K is where
     * Haiku 5.5's price goes up fivefold; 0 turns the check off. */
    maxPromptTokens: 100_000,
  },

  storage: {
    // What each user has paid for (`server/utils/accounts.ts`). Money: it must
    // survive a redeploy, so on a platform whose disk does not, this needs a
    // persistent driver before payments are switched on — and more than one
    // instance needs a shared one (`redis`, say).
    // On Workers there is no filesystem, and the `fs` driver would also drag
    // chokidar/fsevents into the bundle. The KV namespace is bound in
    // wrangler.jsonc under the same name.
    accounts: { driver: "cloudflare-kv-binding", binding: "ACCOUNTS" },
  },
})
