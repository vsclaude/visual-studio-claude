import { defineHandler } from "nitro"

import { addOrder, heldOrder } from "../../utils/accounts.ts"
import { planBySeats } from "../../utils/billing.ts"
import { licenseReady, validDevice } from "../../utils/license.ts"
import { noteRequest } from "../../utils/log.ts"
import { emailOf, fieldsOf } from "../../utils/request.ts"
import { newOrderCode, type Order } from "../../utils/sepay-billing.ts"
import { publicUrlOf, sepayConfig, sepayReady } from "../../utils/sepay.ts"

/**
 * `POST /api/license/checkout` `{ seats, email, device }` — a bank-transfer
 * purchase of Vey Pro for one, three or five devices, answered as `{ url }`:
 * the `/pay/<code>` page with the VietQR. No sign-in: the order is the device
 * it was opened on, which it activates once paid, and the email the key is
 * mailed to for the others (`license.ts`, `GET /api/license`).
 */
export default defineHandler(async (event) => {
  if (!sepayReady() || !licenseReady()) {
    // Which half is missing goes to the log only: the app has nothing to do
    // about either, and the two are set in different places.
    noteRequest(event, {
      refused: !sepayReady()
        ? "Pro not configured: SePay"
        : "Pro not configured: NITRO_LICENSE_PRIVATE_KEY",
    })
    return Response.json(
      { error: "Vey Pro is not for sale on this server." },
      { status: 500 }
    )
  }

  const fields = await fieldsOf(event.req)
  if (fields instanceof Response) return fields
  const plan = planBySeats(fields.seats)
  const email = emailOf(fields.email)
  const device = fields.device
  if (!plan || !email || !validDevice(device)) {
    noteRequest(event, {
      refused: !plan ? "no such plan" : !email ? "no email" : "no device",
    })
    return Response.json(
      {
        error: !email
          ? "Enter the email the licence key should be sent to."
          : "That is not something Vey Pro sells.",
      },
      { status: 400 }
    )
  }

  const held = await heldOrder(device, plan.item, plan.price, email)
  if (held) {
    noteRequest(event, { order: held, item: plan.item, reopened: true })
    return { url: `${publicUrlOf(event)}/pay/${held}` }
  }

  const { prefix } = sepayConfig()
  const order: Order = {
    code: newOrderCode(prefix),
    uid: `device:${device}`,
    email,
    device,
    item: plan.item,
    amount: plan.price,
    createdAt: new Date().toISOString(),
    paidBy: null,
    short: 0,
  }
  for (let tries = 0; !(await addOrder(order)); tries++) {
    if (tries === 4) {
      noteRequest(event, { refused: "no free order code" })
      return Response.json(
        { error: "Could not open an order. Try again." },
        { status: 503 }
      )
    }
    order.code = newOrderCode(prefix)
  }
  noteRequest(event, { order: order.code, item: plan.item, amount: plan.price })
  return { url: `${publicUrlOf(event)}/pay/${order.code}` }
})
