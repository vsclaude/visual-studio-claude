/**
 * What somebody has paid for, whichever way they paid: credits, which are the
 * only way to run a request — there is no free allowance.
 *
 * Two ways in. **Paddle** (`paddle-billing.ts`) is for cards from anywhere.
 * **SePay** (`sepay-billing.ts`) is for Vietnamese bank transfers by VietQR. A
 * pack bought either way adds to the same balance.
 *
 * There are no plans any more, no daily free budget, and no model held back:
 * Haiku, Sonnet and Opus all run on credits, each at its own price
 * (`usage.ts`). An account written while plans were sold
 * keeps its `subscription` and `prepaid` keys on disk, and nothing reads them.
 *
 * Pure — no storage, no config — so `test/billing.test.ts` can feed it.
 */

import { CREDITS_PER_USD } from "./usage.ts"

export type CreditItem =
  "vnd-20k" | "vnd-50k" | "vnd-100k" | "vnd-200k"

/** A pack's size written as the dollars it is sold as, in `usage.ts`'s unit. */
function usd(dollars: number): number {
  return Math.round(dollars * CREDITS_PER_USD)
}

/**
 * Credit packs: the price a transfer must reach, and what the pack adds, in
 * `usage.ts`'s unit — written as the dollars of Anthropic's list price it
 * buys, which is also how every page and the studio show it. Keep in step
 * with the app's `src/shared/credits.ts`, which draws them: a dialog promising
 * another price is a customer who paid what they were shown and is told it
 * was short.
 *
 * The rate is $1.00 of usage per 2.000 ₫, then a bonus on the bigger packs.
 * **It is below cost against Anthropic's own API**, where $1.00 is about
 * 26.300 ₫: it was set against a claimed market price of 1.500 ₫ to the
 * dollar that was never sourced, and has to be repriced before this server
 * is pointed at `api.anthropic.com`. The packs are the four amounts a Vietnamese transfer is made in — 20.000,
 * 50.000, 100.000 and 200.000 ₫. The smallest is **`bankOnly`**: Paddle's
 * fixed $0.50 is about 13.000 ₫ of a 20.000 ₫ pack, and Paddle charges no
 * less than 20.276 ₫ in đồng anyway, so a card buys from 50.000 ₫ up. One
 * table otherwise for both ways of paying (`docs/design.md` § Credits). An
 * id is the pack's price, and `NITRO_PADDLE_PRICE_VND*` is named after it.
 */
export const CREDIT_PACKS: Record<
  CreditItem,
  { price: number; credits: number; bankOnly?: true }
> = {
  "vnd-20k": { price: 20_000, credits: usd(10), bankOnly: true },
  "vnd-50k": { price: 50_000, credits: usd(25) },
  "vnd-100k": { price: 100_000, credits: usd(55) },
  "vnd-200k": { price: 200_000, credits: usd(120) },
}

export function isCreditItem(value: unknown): value is CreditItem {
  return typeof value === "string" && value in CREDIT_PACKS
}

export type Account = {
  /** Left over from the packs bought, in `usage.ts`'s units. */
  credits: number
  /** Credits spent on requests, ever — what the studio shows as used beside
   * what is left. Counted from when it was added; an older account starts at
   * 0 rather than guessing. */
  used: number
  /** Paddle transactions already credited, and by how much — so a webhook
   * delivered twice adds once, and a refund knows what to take back. */
  orders: { id: string; credits: number }[]
}

export const NO_ACCOUNT: Account = {
  credits: 0,
  used: 0,
  orders: [],
}
