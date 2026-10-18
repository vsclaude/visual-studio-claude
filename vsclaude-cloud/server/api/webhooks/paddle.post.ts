import { defineHandler } from "nitro"

import {
  getAccount,
  linkToUser,
  saveAccount,
  userOf,
} from "../../utils/accounts.ts"
import {
  applyWebhook,
  refsOf,
  signatureValid,
} from "../../utils/paddle-billing.ts"
import { noteRequest } from "../../utils/log.ts"
import { paddleConfig } from "../../utils/paddle.ts"

/**
 * `POST /api/webhooks/paddle` — what Paddle says was bought, changed or
 * refunded, applied to the buyer's account (`billing.ts`).
 *
 * The signature is checked over the body **as it arrived**, before anything is
 * parsed. The user is the uid the checkout carried (`checkout.post.ts`), or —
 * for a refund, or a subscription event without the custom data — the one the
 * transaction or subscription was linked to when it carried the uid.
 *
 * An event whose user cannot be found yet is answered 503: Paddle does not
 * promise order, so `subscription.created` can arrive before the
 * `transaction.completed` that links it, and a retry will find it. Anything
 * this server does not sell is answered 200 and logged, since retrying will
 * not make it ours.
 */
export default defineHandler(async (event) => {
  const paddle = paddleConfig()
  if (!paddle.webhookSecret) {
    noteRequest(event, { refused: "no webhook secret configured" })
    return new Response("Not configured", { status: 500 })
  }

  const body = await event.req.text()
  const signature = event.req.headers.get("paddle-signature")
  if (!signatureValid(body, signature, paddle.webhookSecret)) {
    noteRequest(event, { refused: "bad signature" })
    return new Response("Bad signature", { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    noteRequest(event, { refused: "body is not JSON" })
    return new Response("Not JSON", { status: 400 })
  }

  const refs = refsOf(payload)
  noteRequest(event, {
    webhook: refs.event,
    subscription: refs.subscriptionId ?? undefined,
    transaction: refs.transactionId ?? undefined,
  })
  if (
    !refs.event.startsWith("subscription.") &&
    !refs.event.startsWith("transaction.") &&
    !refs.event.startsWith("adjustment.")
  ) {
    noteRequest(event, { ignored: "not an event this server reads" })
    return { ok: true }
  }

  const uid =
    refs.uid ??
    (refs.subscriptionId && (await userOf("sub", refs.subscriptionId))) ??
    (refs.transactionId && (await userOf("txn", refs.transactionId))) ??
    null
  if (!uid) {
    if (refs.event.startsWith("adjustment.")) {
      noteRequest(event, { ignored: "a transaction of nobody's here" })
      return { ok: true }
    }
    noteRequest(event, { deferred: "no user yet; Paddle will retry" })
    return new Response("Unknown user, retry later", { status: 503 })
  }
  noteRequest(event, { uid })

  // Whatever carried the uid links what it names to it, for the events after.
  if (refs.uid) {
    if (refs.subscriptionId) await linkToUser("sub", refs.subscriptionId, uid)
    if (refs.transactionId) await linkToUser("txn", refs.transactionId, uid)
  }

  const applied = applyWebhook(await getAccount(uid), payload, paddle.catalog)
  if (applied.kind === "ignored") {
    noteRequest(event, { ignored: applied.reason })
    return { ok: true }
  }

  await saveAccount(uid, applied.account)
  noteRequest(event, {
    applied: applied.kind,
    plan: applied.kind === "subscription" ? applied.plan : undefined,
    credits_added: applied.kind === "credits" ? applied.added : undefined,
    credits_removed: applied.kind === "refund" ? applied.removed : undefined,
    credits: applied.account.credits,
  })
  return { ok: true }
})
