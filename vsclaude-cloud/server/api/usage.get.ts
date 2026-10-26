import { defineHandler } from "nitro"

import { authenticate } from "../utils/auth.ts"
import { limitsOf } from "../utils/limits.ts"

/**
 * `GET /api/usage` — the signed-in user's credits, left and used, for the
 * studio's credits dialog. Same token as the chat requests.
 */
export default defineHandler(async (event) => {
  const user = await authenticate(event)
  if (user instanceof Response) return user

  const { models, account } = await limitsOf(user.uid)
  return {
    models,
    credits: account.credits,
    creditsUsed: account.used,
  }
})
