import { defineHandler } from "nitro"

import { getAccount } from "../utils/accounts.ts"
import { authenticate } from "../utils/auth.ts"
import { noteRequest } from "../utils/log.ts"
import { paddleApi, paddleConfig } from "../utils/paddle.ts"

/**
 * `POST /api/portal` — a link into Paddle's customer portal for the signed-in
 * user's subscription, where they change plan, update a card or cancel.
 *
 * Asked for on a click rather than kept on the account: a portal session is
 * authenticated and short-lived, and a stored one would be a stale link.
 */
export default defineHandler(async (event) => {
  if (!paddleConfig().apiKey) {
    return Response.json(
      { error: "Payments are not set up on this server." },
      { status: 500 }
    )
  }

  const user = await authenticate(event)
  if (user instanceof Response) return user

  const subscription = (await getAccount(user.uid)).subscription
  if (!subscription?.customerId) {
    return Response.json(
      { error: "You have no plan to manage." },
      { status: 404 }
    )
  }

  const session = await paddleApi(
    `/customers/${encodeURIComponent(subscription.customerId)}/portal-sessions`,
    { subscription_ids: [subscription.id] },
    event.req.signal
  )
  const urls = session.ok
    ? (session.data.urls as { general?: { overview?: unknown } } | undefined)
    : undefined
  const url = urls?.general?.overview
  if (!session.ok || typeof url !== "string") {
    noteRequest(event, {
      refused: "portal session not created",
      upstream_error: session.ok ? "no overview url" : session.error,
    })
    return Response.json(
      { error: "The customer portal could not be opened." },
      { status: 502 }
    )
  }
  return { url }
})
