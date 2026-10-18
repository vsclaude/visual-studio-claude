/**
 * The studio's plans: what the free AI (`shared/free-ai.ts`) is sold as.
 *
 * Also the shapes the server's account calls answer with (`StudioAccount`),
 * since main fetches them and the renderer draws them.
 *
 * **The copy, not the rules.** The server (`vsclaude-cloud`, `billing.ts`)
 * decides what a plan allows and sells it two ways (`PaymentMethod`): by
 * **bank transfer** through SePay, months paid up front, and by **card**
 * through Paddle, a subscription renewed monthly. This table is what the
 * Upgrade dialog draws; the ids are what a purchase is asked for, and the
 * server maps a card one to Paddle's price ids, which are its configuration.
 *
 * Prices are in **Vietnamese đồng**, a month for a plan and once for a credit
 * pack, and must match the server's `MONTHLY_PRICES` and `CREDIT_PACKS` and
 * the prices set in Paddle — or the dialog promises a price the checkout does
 * not charge.
 */

export type PlanId = "hobby" | "starter" | "plus" | "pro"

export type Plan = {
  id: PlanId
  name: string
  /** A month, in VND; 0 for the free plan. */
  price: number
  tagline: string
  /** The models a chat on this plan may pick, in the composer's words. */
  models: string[]
  features: string[]
  /** The one card the dialog draws as the recommendation. */
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "hobby",
    name: "Hobby",
    price: 0,
    tagline: "Try Claude Code with nothing to pay",
    models: ["Haiku"],
    features: [
      "Claude Code in the studio, no Claude subscription",
      "A daily allowance, reset at 00:00 UTC",
      "Every panel of the studio",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 49_000,
    tagline: "For evenings and weekends",
    models: ["Haiku"],
    features: [
      "5× the Hobby allowance",
      "Longer conversations before compacting",
      "Top up with credits when you run out",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: 99_000,
    tagline: "Sonnet for the work that needs it",
    models: ["Haiku", "Sonnet"],
    features: [
      "Everything in Starter",
      "Sonnet for harder changes",
      "15× the Hobby allowance",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 299_000,
    tagline: "Every model, for daily work",
    models: ["Haiku", "Sonnet", "Opus"],
    features: [
      "Everything in Plus",
      "Opus for the hardest problems",
      "30× the Hobby allowance",
      "Still less than a $20 subscription",
    ],
  },
]

export type CreditPack = {
  id: "credits-20k" | "credits-60k" | "credits-100k"
  /** Once, in VND. */
  price: number
  /** What it adds, in the server's input-token equivalents (`usage.ts`). */
  credits: number
  /** A bonus over the base rate, in percent — drawn as a badge. */
  bonus?: number
}

/**
 * Credits for running past a plan's allowance — they do not expire and work
 * on any plan, Hobby included.
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

/** A price as the checkout will show it — `49.000 ₫`. */
export function formatPrice(price: number): string {
  return VND.format(price)
}

export type PaidPlan = Exclude<PlanId, "hobby">

/**
 * How a purchase is paid. `bank` is a VietQR transfer through SePay — no card
 * and no fee to speak of, but nothing renews, so a plan is bought for some
 * months up front. `card` is Paddle, for anybody outside Vietnam: a monthly
 * subscription it renews.
 */
export type PaymentMethod = "bank" | "card"

/** How many months a bank transfer buys a plan for. */
export type Months = 1 | 3 | 12
export const MONTHS: Months[] = [1, 3, 12]

/** Three months cost three; twelve cost ten — two months free for a year. */
export function priceFor(plan: Plan, months: Months): number {
  return plan.price * (months === 12 ? 10 : months)
}

/**
 * What a purchase is asked for: a plan by card is just its id, renewed monthly;
 * a plan by transfer names its months (`plus-3m`); a credit pack is the same
 * either way. The server's `PaddleItem` and `BankItem`.
 */
export type PurchaseItem =
  PaidPlan | `${PaidPlan}-${Months}m` | CreditPack["id"]

export function purchaseItem(
  plan: PaidPlan,
  method: PaymentMethod,
  months: Months
): PurchaseItem {
  return method === "card" ? plan : `${plan}-${months}m`
}

/**
 * The signed-in user's standing on the server, `GET /api/usage` there: their
 * plan, today's spend against its budget, and the credits behind it. The units
 * are the server's input-token equivalents.
 */
export type StudioAccount = {
  plan: PlanId
  models: string[]
  spent: number
  budget: number
  /** 0–100, today's spend against the plan's day. */
  utilization: number
  resetsAt: string
  credits: number
  /** Whether there is a live card subscription for Manage plan to open. */
  subscribed: boolean
  /** When a cancelled card plan ends, while it is still running. */
  cancelsAt: string | null
  /** A plan paid by bank transfer and the day it runs out, while it runs. */
  prepaid: { id: PaidPlan; until: string } | null
}

/** What a buy or Manage plan click came to: a browser opened, or why not. */
export type PurchaseResult = { ok: true } | { ok: false; error: string }

/** Every `PlanId` is on `PLANS`, so the name lookup never misses. */
export function planName(id: PlanId): string {
  return PLANS.find((plan) => plan.id === id)?.name ?? id
}
