import { defineHandler } from "nitro"

import { getOrder, saveOrder } from "../utils/accounts.ts"
import { authenticate } from "../utils/auth.ts"
import { CREDIT_PACKS, isCreditItem } from "../utils/billing.ts"
import { noteRequest } from "../utils/log.ts"
import { newOrderCode, type Order } from "../utils/sepay-billing.ts"
import { publicUrlOf, sepayConfig, sepayReady } from "../utils/sepay.ts"

/**
 * `POST /api/orders` `{ item }` — a bank-transfer purchase for the signed-in
 * user (`credits-60k`, …), answered as `{ url }`: this server's
 * `/pay/<code>` page, with the VietQR to scan. The way in from Vietnam; cards
 * are `api/checkout`.
 *
 * The order is what a transfer is matched to, by the code in its content, so
 * it is written before the page is shown.
 */
export default defineHandler(async (event) => {
  if (!sepayReady()) {
    noteRequest(event, { refused: "SePay not configured" })
    return Response.json(
      { error: "Bank transfer is not set up on this server." },
      { status: 500 }
    )
  }

  const user = await authenticate(event)
  if (user instanceof Response) return user

  let item: unknown
  try {
    item = ((await event.req.json()) as { item?: unknown }).item
  } catch {
    return Response.json({ error: "The body is not JSON." }, { status: 400 })
  }
  if (!isCreditItem(item)) {
    noteRequest(event, { refused: "unknown item" })
    return Response.json({ error: "Nothing here sells that." }, { status: 400 })
  }

  const { prefix } = sepayConfig()
  // A hundred million codes and a handful of orders a day: a clash is all but
  // impossible, and a second draw settles one.
  let code = newOrderCode(prefix)
  for (let tries = 0; tries < 5 && (await getOrder(code)); tries++) {
    code = newOrderCode(prefix)
  }
  const order: Order = {
    code,
    uid: user.uid,
    item,
    amount: CREDIT_PACKS[item].price,
    createdAt: new Date().toISOString(),
    paidBy: null,
    short: [],
  }
  await saveOrder(order)
  noteRequest(event, { order: code, item, amount: order.amount })
  return { url: `${publicUrlOf(event)}/pay/${code}` }
})
