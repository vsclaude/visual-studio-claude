import { defineConfig } from "nitro"

export default defineConfig({
  serverDir: "./server",

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
    /** NITRO_ALLOWED_MODELS — comma-separated; the app's `FREE_AI_MODEL`. */
    allowedModels: "claude-haiku-5-5",
    /** NITRO_DAILY_BUDGET — per user per UTC day, in input-token equivalents
     * (`server/utils/usage.ts`). 0 turns the budget off. */
    dailyBudget: 2_000_000,
    /** NITRO_STARTER_DAILY_BUDGET, _PLUS_, _PRO_ — the paid plans' days, in
     * the same units. Sonnet and Opus spend them at 20× and 40× Haiku's rate
     * (`usage.ts`), so a Pro day of Opus is a fortieth of these in tokens. */
    starterDailyBudget: 10_000_000,
    plusDailyBudget: 30_000_000,
    proDailyBudget: 60_000_000,
    /** NITRO_PADDLE_ENVIRONMENT — `sandbox` or `production`. Two separate
     * Paddle accounts: every Paddle value below belongs to the one named here. */
    paddleEnvironment: "sandbox",
    /** NITRO_PADDLE_API_KEY — creates checkouts and portal sessions. */
    paddleApiKey: "",
    /** NITRO_PADDLE_WEBHOOK_SECRET — the secret key of the notification
     * destination pointed at `/api/webhooks/paddle`. */
    paddleWebhookSecret: "",
    /** NITRO_PADDLE_CLIENT_TOKEN — Paddle.js's, for the `/checkout` page. */
    paddleClientToken: "",
    /** NITRO_PADDLE_PRICE_<ITEM> — each item's `pri_…` id. An empty one is
     * not on sale. */
    paddlePriceStarter: "",
    paddlePricePlus: "",
    paddlePricePro: "",
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

  /*
   * Each user's daily spend. A directory on the server's own disk, which is
   * right for one instance; more than one instance needs a shared driver here
   * (`redis`, say) or each would count its own share of a user's day.
   */
  storage: {
    quota: { driver: "fs", base: "./.data/quota" },
    // What each user has paid for (`server/utils/accounts.ts`). Money, unlike
    // the quota: it must survive a redeploy, so on a platform whose disk does
    // not, this needs a persistent driver before payments are switched on.
    accounts: { driver: "fs", base: "./.data/accounts" },
  },
})
