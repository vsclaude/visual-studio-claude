/**
 * What somebody has paid for, whichever way they paid: credits, which are the
 * only way to run a request — there is no free allowance.
 *
 * Two ways in. **Paddle** (`paddle-billing.ts`) is for cards from anywhere.
 * **SePay** (`sepay-billing.ts`) is for Vietnamese bank transfers by VietQR. A
 * pack bought either way adds to the same balance.
 *
 * There are no plans any more, no daily free budget, and no model held back:
 * DeepSeek's Flash and V4 Pro both run on credits, each at its own price
 * (`usage.ts`). An account written while plans were sold
 * keeps its `subscription` and `prepaid` keys on disk, and nothing reads them.
 *
 * Pure — no storage, no config — so `test/billing.test.ts` can feed it.
 */

import { CREDITS_PER_USD } from "./usage.ts"

export type CreditItem = "vnd-20k" | "vnd-50k" | "vnd-100k" | "vnd-200k"

/**
 * What a dollar of usage sells for. DeepSeek is paid in dollars at about
 * 26.300 ₫ each, so this is roughly 15% over cost before the bonuses — and
 * more in DeepSeek's off-peak hours, which `usage.ts` charges at peak.
 */
export const VND_PER_USD = 30_000

/** What `price` buys at `VND_PER_USD`, plus `bonus` percent, in `usage.ts`'s
 * unit. */
function packOf(price: number, bonus = 0): number {
  return Math.round((price / VND_PER_USD) * (1 + bonus / 100) * CREDITS_PER_USD)
}

/**
 * Credit packs: the price a transfer must reach, and what the pack adds, in
 * `usage.ts`'s unit — written as the dollars of DeepSeek's list price it
 * buys, which is also how every page and the studio show it. Keep in step
 * with the app's `src/shared/credits.ts`, which draws them: a dialog promising
 * another price is a customer who paid what they were shown and is told it
 * was short.
 *
 * The rate is `VND_PER_USD`, then a bonus on the bigger packs. It was 2.000 ₫
 * to the dollar while this server forwarded to a gateway reselling Anthropic
 * at 1.500 ₫; against a provider billed at its list price that is a loss of
 * some 24.000 ₫ on every dollar sold.
 *
 * **Four packs**, the four amounts a Vietnamese transfer is made in — 20.000, 50.000, 100.000 and 200.000 ₫ — with 10% and
 * 20% more on the two biggest. For a while only the 20.000 ₫ one was sold and
 * the rest were `retired`; the flag stays for the next pack withdrawn. The
 * smallest is **`bankOnly`**: Paddle's
 * fixed $0.50 is about 13.000 ₫ of a 20.000 ₫ pack, and Paddle charges no
 * less than 20.276 ₫ in đồng anyway, so a card buys from 50.000 ₫ up. One
 * table otherwise for both ways of paying (`docs/design.md` § Credits). An
 * id is the pack's price, and `NITRO_PADDLE_PRICE_VND*` is named after it.
 */
export const CREDIT_PACKS: Record<
  CreditItem,
  { price: number; credits: number; bankOnly?: true; retired?: true }
> = {
  "vnd-20k": { price: 20_000, credits: packOf(20_000), bankOnly: true },
  "vnd-50k": { price: 50_000, credits: packOf(50_000) },
  "vnd-100k": { price: 100_000, credits: packOf(100_000, 10) },
  "vnd-200k": { price: 200_000, credits: packOf(200_000, 20) },
}

/** Whether it is a pack at all — one still sold or one somebody may already
 * have paid for. A `retired` pack is no longer sold but stays in the table:
 * an order opened before it was withdrawn is still credited when its transfer
 * lands, and a Paddle refund still knows what to take back. */
export function isCreditItem(value: unknown): value is CreditItem {
  return typeof value === "string" && value in CREDIT_PACKS
}

/** Whether a new purchase of it may be opened — any pack not `retired`. */
export function isOnSale(value: unknown): value is CreditItem {
  return isCreditItem(value) && !CREDIT_PACKS[value].retired
}

/** The packs on sale. */
export const ON_SALE = (Object.keys(CREDIT_PACKS) as CreditItem[]).filter(
  (item) => isOnSale(item)
)

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
