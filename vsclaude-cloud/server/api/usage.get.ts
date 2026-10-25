import { defineHandler } from "nitro"

import { stockLeft } from "../utils/accounts.ts"
import { authenticate } from "../utils/auth.ts"
import { ON_SALE } from "../utils/billing.ts"
import { limitsOf } from "../utils/limits.ts"

/**
 * `GET /api/usage` — the signed-in user's credits, left and used, for the
 * studio's credits dialog. Same token as the chat requests. `stock` is how
 * many more of each pack on sale can be bought, which the dialog draws on the
 * pack — the studio polls this already while a payment is awaited, so the
 * count moves without a call of its own.
 */
export default defineHandler(async (event) => {
  const user = await authenticate(event)
  if (user instanceof Response) return user

  const { models, account } = await limitsOf(user.uid)
  return {
    models,
    credits: account.credits,
    creditsUsed: account.used,
    // Their own unpaid order is not held against them (`stockLeft`).
    stock: await stockLeft(ON_SALE, user.uid),
  }
})
