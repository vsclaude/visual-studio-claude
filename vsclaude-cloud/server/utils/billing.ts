/**
 * What is sold: **Vey Pro**, a licence for one, three or five devices, bought
 * once by bank transfer (`sepay-billing.ts`). Free is one project; Pro is
 * every project after it. A paid order for one of these plans makes a licence
 * key with that many seats and activates the device it was bought on
 * (`license.ts`); the key, mailed to the buyer, activates the others. The
 * prices must match the app's `PRO_PLANS` (`src/shared/license.ts`).
 *
 * No sign-in: an order is the device it was opened on and an email to send
 * the key to (README § Vey Pro). `pro` is the one item sold while Pro
 * belonged to a Google account — an order for it still in `transactions`
 * reads as one device.
 *
 * Credits were sold here once — packs by transfer and by Paddle card, spent on
 * requests this server forwarded to Anthropic — and are deleted with the
 * forwarding (README § Credits, removed). An order for a pack, or for a plan
 * from before that, still in `transactions` grants nothing if paid now: that
 * money is a human's to refund.
 *
 * Pure — no storage, no config.
 */

export type ProPlan = {
  /** The order's `item`. */
  item: string
  /** How many devices the key activates at once. */
  seats: number
  /** VND, once. */
  price: number
}

export const PRO_PLANS: readonly ProPlan[] = [
  // TEMPORARY (2026-10-28): 2.000 ₫ to test a real purchase end to end. The
  // price is 99_000 — put it back here and in the app's `PRO_PLANS` together.
  { item: "pro-1", seats: 1, price: 2_000 },
  { item: "pro-3", seats: 3, price: 199_000 },
  { item: "pro-5", seats: 5, price: 299_000 },
]

/** The Google-account era's one item: a licence for one device. */
const LEGACY_PRO = "pro"

/** The plan an order's item buys, or null for one nothing grants any more. */
export function planOf(item: unknown): ProPlan | null {
  if (item === LEGACY_PRO) return { item: LEGACY_PRO, seats: 1, price: 0 }
  return PRO_PLANS.find((plan) => plan.item === item) ?? null
}

/** A plan by its seat count, as the app asks for it. */
export function planBySeats(seats: unknown): ProPlan | null {
  return PRO_PLANS.find((plan) => plan.seats === seats) ?? null
}
