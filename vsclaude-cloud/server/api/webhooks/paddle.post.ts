import { defineHandler } from "nitro"

import {
  creditPaddleTransaction,
  getAccount,
  linkToUser,
  refundPaddleTransaction,
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
 * `POST /api/webhooks/paddle` — what Paddle says was bought or refunded,
 * applied to the buyer's account (`billing.ts`).
 *
 * The signature is checked over the body **as it arrived**, before anything is
 * parsed. The user is the uid the checkout carried (`checkout.post.ts`), or —
 * for a refund — the one the transaction was linked to when it carried the
 * uid.
 *
 * A transaction whose user cannot be found yet is answered 503, so Paddle
 * retries it. Anything this server does not sell — `subscription.*` among
 * them, since there are no plans any more — is answered 200 and logged, since
 * retrying will not make it ours.
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
    transaction: refs.transactionId ?? undefined,
  })
  if (
    !refs.event.startsWith("transaction.") &&
    !refs.event.startsWith("adjustment.")
  ) {
    noteRequest(event, { ignored: "not an event this server reads" })
    return { ok: true }
  }

  const uid =
    refs.uid ??
    (refs.transactionId && (await userOf(refs.transactionId))) ??
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
  if (refs.uid && refs.transactionId) {
    await linkToUser(refs.transactionId, uid)
  }

  const applied = applyWebhook(await getAccount(uid), payload, paddle.catalog)
  if (applied.kind === "ignored") {
    noteRequest(event, { ignored: applied.reason })
    return { ok: true }
  }

  if (applied.kind === "credits") {
    await creditPaddleTransaction(uid, applied.transactionId, applied.added)
  } else {
    await refundPaddleTransaction(uid, applied.transactionId)
  }
  noteRequest(event, {
    applied: applied.kind,
    credits_added: applied.kind === "credits" ? applied.added : undefined,
    credits_removed: applied.kind === "refund" ? applied.removed : undefined,
    credits: applied.account.credits,
  })
  return { ok: true }
})
