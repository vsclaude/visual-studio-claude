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

export type CreditItem = "credits-20k" | "credits-60k" | "credits-100k"

/**
 * Credit packs: the price a transfer must reach, and what the pack adds in
 * `usage.ts`'s input-token equivalents. Keep in step with the app's `src/shared/credits.ts`, which
 * draws them: a dialog promising another price is a customer who paid what
 * they were shown and is told it was short.
 *
 * The rate is 200,000 credits per 1,000 ₫, then a bonus on the bigger packs.
 * A million credits is $0.10 of Anthropic's price (`usage.ts`), about
 * 2,630 ₫ at 26,300 ₫/USD, so the small pack charges 1.9× that and the large
 * 1.6× — enough for Paddle's 5% + $0.50 a transaction, VAT and the đồng
 * drifting against the dollar, and still a price a developer who knows the
 * API's can look at. The smallest is 50.000 ₫ and not less because the $0.50
 * is fixed: on 25.000 ₫ it was 58% of the price. One table for both ways of
 * paying — a VietQR transfer costs nothing per transaction, so it is simply
 * the better side of the same margin rather than a second price list
 * (`docs/design.md` § Credits). The ids carry the prices of an earlier table
 * and are kept: `NITRO_PADDLE_PRICE_CREDITS*` is named after them.
 */
export const CREDIT_PACKS: Record<
  CreditItem,
  { price: number; credits: number }
> = {
  "credits-20k": { price: 50_000, credits: 10_000_000 },
  "credits-60k": { price: 100_000, credits: 22_000_000 },
  "credits-100k": { price: 200_000, credits: 48_000_000 },
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
