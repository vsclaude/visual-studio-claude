/**
 * The studio's plans: what the free AI (`shared/free-ai.ts`) is sold as.
 *
 * **Static, and not yet enforced.** The server still holds every signed-in
 * user to one model list and one daily budget, and nothing takes a payment, so
 * everybody signed in is on `hobby` and the other rows are what the Upgrade
 * dialog offers. When the server learns a user's plan this table is what it
 * and the dialog should agree on — the limits here are the copy the dialog
 * draws, not numbers anything checks.
 *
 * Prices are in US dollars, a month for a plan and once for a credit pack.
 */

export type PlanId = "hobby" | "starter" | "plus" | "pro"

export type Plan = {
  id: PlanId
  name: string
  /** A month, in USD; 0 for the free plan. */
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
    price: 5,
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
    price: 10,
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
    price: 15,
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
  id: string
  /** Once, in USD. */
  price: number
  /** What it adds, in the server's input-token equivalents (`usage.ts`). */
  credits: number
  /** A bonus over the base rate, in percent — drawn as a badge. */
  bonus?: number
}

/** Credits for running past a plan's allowance — they do not expire and work
 * on any plan, Hobby included. */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-3", price: 3, credits: 3_000_000 },
  { id: "credits-10", price: 10, credits: 11_000_000, bonus: 10 },
  { id: "credits-25", price: 25, credits: 30_000_000, bonus: 20 },
]

/** The plan of everybody signed in, until the server can say otherwise. */
export const CURRENT_PLAN: PlanId = "hobby"

/** Every `PlanId` is on `PLANS`, so the name lookup never misses. */
export function planName(id: PlanId): string {
  return PLANS.find((plan) => plan.id === id)?.name ?? id
}
