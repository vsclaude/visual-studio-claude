import { defineHandler } from "nitro"

import { authenticate } from "../utils/auth.ts"
import { CREDIT_PACKS, isOnSale } from "../utils/billing.ts"
import { noteRequest } from "../utils/log.ts"
import { paddleApi, paddleConfig, paddleCustomerOf } from "../utils/paddle.ts"

/**
 * `POST /api/checkout` `{ item }` — a Paddle card checkout for the signed-in
 * user, the way in from outside Vietnam (bank transfers are `api/orders`),
 * answered as `{ url }` for the studio to open in a browser. `item` is the
 * app's id for the pack bought (`vnd-50k`, …), never a price id.
 *
 * A transaction is created here rather than a checkout opened from a page
 * because the uid has to ride on it (`custom_data`), and that is the only thing
 * that lets the webhook know whose credits to add. Paddle answers with a link
 * to the default payment link (`GET /checkout` here) carrying `_ptxn`, which
 * Paddle.js opens on its own.
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
  if (!isOnSale(item)) {
    noteRequest(event, { refused: "not on sale" })
    return Response.json({ error: "Nothing here sells that." }, { status: 400 })
  }
  if (CREDIT_PACKS[item].bankOnly) {
    noteRequest(event, { refused: `${item} is bank transfer only` })
    return Response.json(
      { error: "That pack is sold by bank transfer only." },
      { status: 400 }
    )
  }
  const price = paddle.prices[item]
  if (!price) {
    noteRequest(event, { refused: `no price configured for ${item}` })
    return Response.json({ error: "That is not on sale yet." }, { status: 500 })
  }

  // The email Google gave us, so the checkout does not ask for it again. If
  // Paddle cannot give a customer, the checkout still opens — and asks.
  const customer = user.email
    ? await paddleCustomerOf(user.email, user.uid, event.req.signal)
    : null

  const created = await paddleApi(
    "/transactions",
    {
      items: [{ price_id: price, quantity: 1 }],
      ...(customer ? { customer_id: customer } : {}),
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
