/**
 * What somebody has paid for, whichever way they paid: a plan, and credits for
 * what runs past its day.
 *
 * Two ways in. **Paddle** (`paddle-billing.ts`) is for cards from anywhere: a
 * monthly subscription that renews itself. **SePay** (`sepay-billing.ts`) is
 * for Vietnamese bank transfers by VietQR: no card, so nothing renews, and a
 * plan is bought for 1, 3 or 12 months up front. One account holds either —
 * the routes refuse a second plan from the other side while one is live, since
 * that would be paying twice for one plan.
 *
 * Pure — no storage, no config — so `test/billing.test.ts` can feed it.
 */

export type PlanId = "hobby" | "starter" | "plus" | "pro"
export type PaidPlan = Exclude<PlanId, "hobby">
export type CreditItem = "credits-20k" | "credits-60k" | "credits-100k"

/**
 * Each plan's price for one month, in VND — what the bank-transfer QR asks for
 * (Paddle's prices are set in Paddle, at the same amounts). Keep in step with
 * the app's `src/shared/plans.ts`, which draws them: a dialog promising another
 * price is a customer who paid what they were shown and is told it was short.
 */
export const MONTHLY_PRICES: Record<PaidPlan, number> = {
  starter: 49_000,
  plus: 99_000,
  pro: 299_000,
}

/**
 * Credit packs: the price a transfer must reach, and what the pack adds in the
 * budget's units. The smallest is 25.000 ₫ although its id says 20k: Paddle
 * will not charge less than 20.276 ₫, and one price on both sides is one less
 * thing for the dialog to explain.
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

/** The models a plan adds to the server's own list (`allowedModels`, which
 * every plan gets). */
export const PLAN_MODELS: Record<PlanId, string[]> = {
  hobby: [],
  starter: [],
  plus: ["claude-sonnet-5-5"],
  pro: ["claude-sonnet-5-5", "claude-opus-5-5"],
}

const RANK: Record<PlanId, number> = { hobby: 0, starter: 1, plus: 2, pro: 3 }

/** A Paddle subscription, as its webhooks last described it. */
export type Subscription = {
  id: string
  plan: PaidPlan
  status: string
  /** Paddle's customer, for a portal session (`api/portal.post.ts`). */
  customerId: string | null
  /** When a cancellation takes effect, while it is still scheduled. */
  cancelsAt: string | null
  /** The `updated_at` of the payload this was read from: Paddle does not
   * promise order, so an older one arriving late is ignored. */
  updatedAt: string
}

export type Account = {
  /** A Paddle subscription, live or not. */
  subscription: Subscription | null
  /** A plan bought by bank transfer, and when it runs out. */
  prepaid: { id: PaidPlan; until: string } | null
  /** Left over from the packs bought, in the budget's units. */
  credits: number
  /** Paddle transactions already credited, and by how much — so a webhook
   * delivered twice adds once, and a refund knows what to take back. */
  orders: { id: string; credits: number }[]
}

export const NO_ACCOUNT: Account = {
  subscription: null,
  prepaid: null,
  credits: 0,
  orders: [],
}

/**
 * Whether a Paddle subscription still grants its plan.
 *
 * A cancellation at the end of the period leaves Paddle's status `active`
 * until then, so `canceled` means it is over. `past_due` still grants — a
 * renewal failed and Paddle is retrying, and cutting somebody off on the first
 * declined card punishes a bank's hiccup. `paused` does not.
 */
export function grants(subscription: Subscription): boolean {
  return ["active", "trialing", "past_due"].includes(subscription.status)
}

export function prepaidLive(account: Account, now = new Date()): boolean {
  return account.prepaid !== null && new Date(account.prepaid.until) > now
}

/** The plan a request runs on: the better of what the two sides grant. */
export function planOf(account: Account, now = new Date()): PlanId {
  const fromCard =
    account.subscription && grants(account.subscription)
      ? account.subscription.plan
      : "hobby"
  const fromTransfer: PlanId =
    account.prepaid && prepaidLive(account, now) ? account.prepaid.id : "hobby"
  return RANK[fromCard] >= RANK[fromTransfer] ? fromCard : fromTransfer
}

/**
 * How much of a request's cost comes out of credits: whatever pushed the day
 * past the plan's budget, and no more than was past it before the request
 * began. A budget of 0 is no budget — nothing is ever drawn from credits.
 */
export function creditCharge(
  before: number,
  after: number,
  budget: number
): number {
  if (budget <= 0) return 0
  return Math.max(0, after - budget) - Math.max(0, before - budget)
}
