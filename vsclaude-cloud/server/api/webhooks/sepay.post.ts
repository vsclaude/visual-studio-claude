import { defineHandler } from "nitro"

import { addShortfall, getOrder, payOrder } from "../../utils/accounts.ts"
import { sendEmailLater } from "../../utils/email.ts"
import { grantLicense } from "../../utils/license.ts"
import { noteRequest } from "../../utils/log.ts"
import { proEmail } from "../../utils/mail.ts"
import {
  applyTransfer,
  orderCodeOf,
  transferOf,
  webhookAuthentic,
} from "../../utils/sepay-billing.ts"
import { publicUrlOf, sepayConfig } from "../../utils/sepay.ts"

/**
 * `POST /api/webhooks/sepay` — a transfer SePay saw arrive in the account,
 * applied to the Vey Pro order its content names (`sepay-billing.ts`).
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
  const paid = applyTransfer(order, transfer)
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
  // The order is paid, then its key is made — one per order, with the plan's
  // seats — the device it was bought on put on it, and the key mailed to the
  // buyer for the others. The app on that device picks its activation up
  // itself (`GET /api/license`).
  //
  // A key that could not be made is logged and the delivery still
  // acknowledged: the order is paid now, so SePay's retry would be ignored,
  // and `GET /api/license` makes it the next time the app asks
  // (`grantLicense`) — once whatever threw here is fixed.
  if (await payOrder(order, transfer.id)) {
    try {
      const license = await grantLicense(order)
      noteRequest(event, { licensed: license !== null })
      if (license && order.email) {
        sendEmailLater(
          event,
          proEmail(
            {
              to: order.email,
              key: license.key,
              seats: license.seats,
              amount: transfer.transferAmount,
              order: order.code,
            },
            publicUrlOf(event)
          )
        )
      }
    } catch (error) {
      console.error("[sepay] paid, but the licence could not be granted", {
        order: order.code,
        error,
      })
      noteRequest(event, { licensed: false, license_error: String(error) })
    }
  }
  return DONE()
})
