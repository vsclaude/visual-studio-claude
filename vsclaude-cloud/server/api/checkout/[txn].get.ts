import { defineHandler } from "nitro"

import { paddlePurchase } from "../../utils/accounts.ts"

/**
 * `GET /api/checkout/<txn>` — whether a Paddle purchase is credited and how
 * much it added, for the `/checkout` page to poll once Paddle says the payment
 * went through. No token, like `api/orders/<code>`: the page has none, and this
 * says a transaction's amount of credits — not whose it is.
 *
 * A 404 is the answer for a few seconds after the payment: the webhook has not
 * yet said whose transaction it is, so the page keeps asking.
 */
export default defineHandler(async (event) => {
  const id = String(event.context.params?.txn ?? "")
  const purchase = await paddlePurchase(id)
  if (!purchase) {
    return Response.json({ error: "No such purchase." }, { status: 404 })
  }
  return { id, ...purchase }
})
