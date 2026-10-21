import { defineHandler } from "nitro"

import { getOrder } from "../../utils/accounts.ts"
import { CREDIT_PACKS, isCreditItem } from "../../utils/billing.ts"

/**
 * `GET /api/orders/<code>` — whether an order is paid, for the `/pay` page to
 * poll. No token: the page is opened in a browser that has none, and all it
 * says is a code's amount, what it buys and whether it arrived — not whose it
 * is.
 */
export default defineHandler(async (event) => {
  const code = String(event.context.params?.code ?? "").toUpperCase()
  const order = await getOrder(code)
  if (!order) {
    return Response.json({ error: "No such order." }, { status: 404 })
  }
  return {
    code: order.code,
    item: order.item,
    amount: order.amount,
    paid: order.paidBy !== null,
    // What the pack adds, for the arrival card — the same figure the credits
    // are added by (`CREDIT_PACKS`), so the card and the balance agree.
    credits: isCreditItem(order.item) ? CREDIT_PACKS[order.item].credits : 0,
    // A transfer that carried the code but not enough — the page says so
    // rather than waiting forever.
    short: order.short,
  }
})
