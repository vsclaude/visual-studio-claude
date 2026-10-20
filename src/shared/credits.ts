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
 * 200,000 credits per 1,000 ₫, plus the bonus the bigger packs are badged
 * with: 100.000 ₫ is 20M and 10% more, 200.000 ₫ is 40M and 20% more, so the
 * badge and the number say the same thing. Why that rate, and why nothing
 * under 50.000 ₫, is the server's `billing.ts`. The ids name an earlier
 * table's prices and stay: they are the server's item names
 * (`NITRO_PADDLE_PRICE_CREDITS20K`), which renaming would break. The same
 * price by bank transfer, so the pack has one price whichever way it is paid.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-20k", price: 50_000, credits: 10_000_000 },
  {
    id: "credits-60k",
    price: 100_000,
    credits: 22_000_000,
    bonus: 10,
    popular: true,
  },
  {
    id: "credits-100k",
    price: 200_000,
    credits: 48_000_000,
    bonus: 20,
  },
]

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

/** A price as the checkout will show it — `50.000 ₫`. */
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

/**
 * How much of everything bought is left, for the bars that empty as it is
 * spent — and whether that is little enough to say so.
 *
 * All-time, because `credits` and `creditsUsed` are the only two numbers the
 * server hands over and a pack has no end date to measure a month against. A
 * tenth is where a balance stops being something to forget about; nothing at
 * all is `low` too, so a bar at zero is never drawn in the calm colours.
 */
export function creditsLeft(account: StudioAccount): {
  share: number
  low: boolean
} {
  const total = account.credits + account.creditsUsed
  const share = total > 0 ? Math.max(0, account.credits) / total : 0
  return { share, low: share <= 0.1 }
}

/** `3.3M`, `250,000` — a balance as the dialogs write it. */
export function formatCredits(credits: number): string {
  return credits >= 1_000_000
    ? `${Number((credits / 1_000_000).toFixed(1))}M`
    : credits.toLocaleString("en-US")
}

/** What a buy click came to: a browser opened, or why not. */
export type PurchaseResult = { ok: true } | { ok: false; error: string }
