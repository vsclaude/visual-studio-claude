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
 * they were shown and is told it was short. The smallest is 25.000 ₫ although
 * its id says 20k: Paddle will not charge less than 20.276 ₫, and one price on
 * both sides is one less thing for the dialog to explain.
 */
export const CREDIT_PACKS: Record<
  CreditItem,
  { price: number; credits: number }
> = {
  "credits-20k": { price: 25_000, credits: 1_000_000 },
  "credits-60k": { price: 60_000, credits: 3_300_000 },
  "credits-100k": { price: 100_000, credits: 6_000_000 },
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
