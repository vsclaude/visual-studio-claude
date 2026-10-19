/**
 * What the free AI (`shared/free-ai.ts`) sells: credit packs.
 *
 * Also the shapes the server's account calls answer with (`StudioAccount`),
 * since main fetches them and the renderer draws them.
 *
 * **The copy, not the rules.** The server (`vsclaude-cloud`, `billing.ts`)
 * decides what credits pay for and sells them two ways (`PaymentMethod`): by
 * **bank transfer** through SePay and by **card** through Paddle. This table is
 * what the credits dialog draws; the ids are what a purchase is asked for, and
 * the server maps a card one to Paddle's price ids, which are its
 * configuration.
 *
 * Prices are in **Vietnamese đồng** and must match the server's `CREDIT_PACKS`
 * and the prices set in Paddle — or the dialog promises a price the checkout
 * does not charge.
 *
 * There were monthly plans here once — Starter, Plus and Pro — and they are
 * withdrawn: `docs/design.md` § Plans, removed.
 */

export type CreditPack = {
  id: "credits-20k" | "credits-60k" | "credits-100k"
  /** Once, in VND. */
  price: number
  /** What it adds, in the server's input-token equivalents (`usage.ts`). */
  credits: number
  /** A bonus over the base rate, in percent — drawn as a badge. */
  bonus?: number
  /**
   * The pack the dialog steers toward — raised, ringed and given the filled
   * button. One at most: two highlights are no highlight.
   */
  popular?: boolean
}

/**
 * Credits, which every Studio AI request is paid for out of, on any model —
 * they do not expire.
 *
 * The smallest pack is 25.000 ₫ although its id says 20k: Paddle will not
 * charge less than 20.276 ₫, and the id is the server's item name
 * (`NITRO_PADDLE_PRICE_CREDITS20K`), which renaming would break. The same
 * price by bank transfer, so the pack has one price whichever way it is paid.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-20k", price: 25_000, credits: 1_000_000 },
  {
    id: "credits-60k",
    price: 60_000,
    credits: 3_300_000,
    bonus: 10,
    popular: true,
  },
  {
    id: "credits-100k",
    price: 100_000,
    credits: 6_000_000,
    bonus: 20,
  },
]

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

/** A price as the checkout will show it — `25.000 ₫`. */
export function formatPrice(price: number): string {
  return VND.format(price)
}

/**
 * How a purchase is paid. `bank` is a VietQR transfer through SePay — no card
 * and no fee to speak of. `card` is Paddle, for anybody outside Vietnam.
 */
export type PaymentMethod = "bank" | "card"

/**
 * The signed-in user's credits on the server, `GET /api/usage` there, in the
 * server's input-token equivalents. Every Studio AI request is paid for out of
 * them; there is no free allowance.
 */
export type StudioAccount = {
  /** The models the server runs. */
  models: string[]
  /** Left to spend. */
  credits: number
  /** Spent so far, ever — 0 from a server too old to count it. */
  creditsUsed: number
}

/**
 * How many credits arrived between two reads of the account, or 0.
 *
 * Nothing on a first read — `before` is null after a launch or a sign-in, and
 * a balance seen for the first time is not one that just went up. A drop is
 * spending, or a refund, and is not an arrival either.
 */
export function creditsArrived(
  before: StudioAccount | null,
  after: StudioAccount | null
): number {
  if (!before || !after) return 0
  return Math.max(0, after.credits - before.credits)
}

/** `3.3M`, `250,000` — a balance as the dialogs write it. */
export function formatCredits(credits: number): string {
  return credits >= 1_000_000
    ? `${Number((credits / 1_000_000).toFixed(1))}M`
    : credits.toLocaleString("en-US")
}

/** What a buy click came to: a browser opened, or why not. */
export type PurchaseResult = { ok: true } | { ok: false; error: string }
