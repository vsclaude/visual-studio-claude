import { defineHandler } from "nitro"

import { authenticate } from "../utils/auth.ts"
import { grants, prepaidLive } from "../utils/billing.ts"
import { limitsOf } from "../utils/limits.ts"
import { secondsToReset, spentToday } from "../utils/quota.ts"

/**
 * `GET /api/usage` — the signed-in user's plan, how much of its day they have
 * spent, and the credits behind it, for a meter in the studio. Same token as
 * the chat requests.
 */
export default defineHandler(async (event) => {
  const user = await authenticate(event)
  if (user instanceof Response) return user

  const { plan, models, budget, account } = await limitsOf(user.uid)
  const spent = await spentToday(user.uid)
  return {
    plan,
    models,
    spent,
    budget,
    // A percentage the studio can draw without knowing the unit.
    utilization: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0,
    resetsAt: new Date(Date.now() + secondsToReset() * 1000).toISOString(),
    credits: account.credits,
    // A live card subscription for `POST /api/portal` to manage, and the date
    // a cancellation takes it away.
    subscribed:
      account.subscription !== null &&
      account.subscription.customerId !== null &&
      grants(account.subscription),
    cancelsAt: account.subscription?.cancelsAt ?? null,
    // A plan paid by bank transfer, while it runs — buying again extends it.
    prepaid: prepaidLive(account) ? account.prepaid : null,
  }
})
