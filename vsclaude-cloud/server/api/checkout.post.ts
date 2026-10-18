import { defineHandler } from "nitro"

import { getAccount } from "../utils/accounts.ts"
import { authenticate } from "../utils/auth.ts"
import { grants, isCreditItem, prepaidLive } from "../utils/billing.ts"
import { noteRequest } from "../utils/log.ts"
import { isPaddleItem } from "../utils/paddle-billing.ts"
import { paddleApi, paddleConfig } from "../utils/paddle.ts"

/**
 * `POST /api/checkout` `{ item }` — a Paddle card checkout for the signed-in
 * user, the way in from outside Vietnam (bank transfers are `api/orders`),
 * answered as `{ url }` for the studio to open in a browser. `item` is the
 * app's id for what is bought (`starter`, `credits-20k`, …), never a price id.
 *
 * A transaction is created here rather than a checkout opened from a page
 * because the uid has to ride on it (`custom_data`), and that is the only thing
 * that lets the webhook know whose plan to change. Paddle answers with a link
 * to the default payment link (`GET /checkout` here) carrying `_ptxn`, which
 * Paddle.js opens on its own.
 *
 * A second plan is refused while one is live, from either side: two
 * subscriptions would be two charges a month for one plan, and a subscription
 * on top of a prepaid month would be paying twice for the same days. Changing
 * plan is the customer portal's (`POST /api/portal`).
 */
export default defineHandler(async (event) => {
  const paddle = paddleConfig()
  if (!paddle.apiKey) {
    noteRequest(event, { refused: "no Paddle key configured" })
    return Response.json(
      { error: "Payments are not set up on this server." },
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
  if (!isPaddleItem(item)) {
    noteRequest(event, { refused: "unknown item" })
    return Response.json({ error: "Nothing here sells that." }, { status: 400 })
  }
  const price = paddle.prices[item]
  if (!price) {
    noteRequest(event, { refused: `no price configured for ${item}` })
    return Response.json({ error: "That is not on sale yet." }, { status: 500 })
  }

  if (!isCreditItem(item)) {
    const account = await getAccount(user.uid)
    if (account.subscription && grants(account.subscription)) {
      noteRequest(event, { refused: "already subscribed" })
      return Response.json(
        { error: "You already have a plan. Change it from Manage plan." },
        { status: 409 }
      )
    }
    if (prepaidLive(account)) {
      noteRequest(event, { refused: "prepaid plan live" })
      return Response.json(
        {
          error:
            "Your plan is paid by bank transfer until it runs out. Extend it the same way, or subscribe by card once it has ended.",
        },
        { status: 409 }
      )
    }
  }

  const created = await paddleApi(
    "/transactions",
    {
      items: [{ price_id: price, quantity: 1 }],
      custom_data: { uid: user.uid },
    },
    event.req.signal
  )
  const checkout = created.ok
    ? (created.data.checkout as { url?: unknown } | null | undefined)
    : undefined
  if (!created.ok || typeof checkout?.url !== "string") {
    noteRequest(event, {
      refused: "checkout not created",
      upstream_error: created.ok
        ? "no checkout url — is a default payment link set?"
        : created.error,
    })
    return Response.json(
      { error: "The checkout could not be created." },
      { status: 502 }
    )
  }
  noteRequest(event, { checkout: item, transaction: String(created.data.id) })
  return { url: checkout.url }
})
