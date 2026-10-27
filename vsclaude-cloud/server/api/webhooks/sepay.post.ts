import { defineHandler } from "nitro"

import {
  addShortfall,
  getAccount,
  getOrder,
  getUser,
  payOrder,
} from "../../utils/accounts.ts"
import { sendEmailLater } from "../../utils/email.ts"
import { noteRequest } from "../../utils/log.ts"
import { paymentEmail } from "../../utils/mail.ts"
import {
  applyTransfer,
  orderCodeOf,
  transferOf,
  webhookAuthentic,
} from "../../utils/sepay-billing.ts"
import { publicUrlOf, sepayConfig } from "../../utils/sepay.ts"

/**
 * `POST /api/webhooks/sepay` — a transfer SePay saw arrive in the account,
 * applied to the order its content names (`sepay-billing.ts`).
 *
 * SePay counts a delivery as done only on a 200 whose body is **exactly**
 * `{"success": true}`; anything else is retried up to seven times over half an
 * hour. So every transfer that is not ours — another payment into the same
 * account, money going out, a code nobody issued — is acknowledged that way
 * too, and logged: retrying will not make it ours. Only a failure on this
 * side's storage is left unacknowledged, so SePay tries again.
 */
const DONE = () => Response.json({ success: true })

export default defineHandler(async (event) => {
  const sepay = sepayConfig()
  const body = await event.req.text()
  if (
    !webhookAuthentic(body, event.req.headers, {
      secret: sepay.webhookSecret,
      apiKey: sepay.apiKey,
    })
  ) {
    noteRequest(event, { refused: "not authenticated as SePay" })
    return new Response("Unauthorized", { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    noteRequest(event, { refused: "body is not JSON" })
    return new Response("Not JSON", { status: 400 })
  }

  const transfer = transferOf(payload)
  if (!transfer) {
    noteRequest(event, { ignored: "not a transaction" })
    return DONE()
  }
  const code = orderCodeOf(transfer, sepay.prefix)
  noteRequest(event, {
    sepay: transfer.id,
    amount: transfer.transferAmount,
    order: code ?? undefined,
  })
  if (!code) {
    noteRequest(event, { ignored: "no order code in the content" })
    return DONE()
  }
  const order = await getOrder(code)
  if (!order) {
    noteRequest(event, { ignored: "no such order" })
    return DONE()
  }
  const paid = applyTransfer(order, await getAccount(order.uid), transfer)
  noteRequest(event, { uid: order.uid, applied: paid.kind })
  if (paid.kind === "ignored") {
    noteRequest(event, { ignored: paid.reason })
    return DONE()
  }
  if (paid.kind === "short") {
    await addShortfall(order.code, {
      id: transfer.id,
      amount: transfer.transferAmount,
    })
    noteRequest(event, { short_of: paid.order.amount })
    return DONE()
  }
  // The thank-you goes with the delivery that added the credits, not with a
  // retry of it.
  if (await payOrder(order, transfer.id, paid.added)) {
    const user = await getUser(order.uid)
    if (user) {
      sendEmailLater(
        event,
        paymentEmail(
          user,
          {
            credits: paid.added,
            amount: transfer.transferAmount,
            currency: "VND",
            order: order.code,
          },
          publicUrlOf(event)
        )
      )
    }
  }
  noteRequest(event, { credits_added: paid.added })
  return DONE()
})
