import { useRuntimeConfig } from "nitro/runtime-config"

import { listOf } from "./anthropic.ts"
import { getAccount } from "./accounts.ts"
import { planOf, PLAN_MODELS, type Account, type PlanId } from "./billing.ts"

/** What a user may do today: their plan, its models and its daily budget, and
 * the account behind it for the credits. */
export type Limits = {
  plan: PlanId
  models: string[]
  budget: number
  account: Account
}

export async function limitsOf(uid: string): Promise<Limits> {
  const config = useRuntimeConfig()
  const account = await getAccount(uid)
  const plan = planOf(account)
  const budgets: Record<PlanId, unknown> = {
    hobby: config.dailyBudget,
    starter: config.starterDailyBudget,
    plus: config.plusDailyBudget,
    pro: config.proDailyBudget,
  }
  return {
    plan,
    models: [...listOf(String(config.allowedModels)), ...PLAN_MODELS[plan]],
    budget: Number(budgets[plan]),
    account,
  }
}

const NAMES: Record<PlanId, string> = {
  hobby: "Hobby",
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
}

export function planName(plan: PlanId): string {
  return NAMES[plan]
}
