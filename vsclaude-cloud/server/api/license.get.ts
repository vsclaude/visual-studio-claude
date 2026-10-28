import { defineHandler } from "nitro"

import { isActivated, paidOrderOn } from "../utils/accounts.ts"
import { activationFor, grantLicense, validDevice } from "../utils/license.ts"
import { noteRequest } from "../utils/log.ts"

/**
 * `GET /api/license?device=<id>` — the licence a purchase made on this device
 * bought, `{ key, activation }`, once its transfer has landed; 404 before.
 * The app asks while a checkout it opened is waiting, and on focus.
 *
 * The device id is the app's own random UUID and the only thing that asks:
 * whoever has it is that app. A paid order whose key was never made — the
 * webhook marks the order paid before it signs — is made here
 * (`grantLicense`), so a failure there heals on the app's next ask. A key
 * since revoked (a refund) is a 410. A device that has deactivated itself is
 * a 404 again: the purchase put it on once, not for good.
 */
export default defineHandler(async (event) => {
  const device = new URL(event.req.url).searchParams.get("device")
  if (!validDevice(device)) {
    noteRequest(event, { refused: "no device" })
    return Response.json({ error: "No device." }, { status: 400 })
  }

  const order = await paidOrderOn(device)
  if (!order) {
    noteRequest(event, { license: "none" })
    return Response.json({ error: "No licence yet." }, { status: 404 })
  }
  noteRequest(event, { order: order.code })

  try {
    const license = await grantLicense(order)
    if (!license) {
      noteRequest(event, { license: "nothing granted", item: order.item })
      return Response.json({ error: "No licence yet." }, { status: 404 })
    }
    if (license.revoked) {
      noteRequest(event, { license: "revoked" })
      return Response.json(
        { error: "This licence was refunded." },
        { status: 410 }
      )
    }
    // Deactivated since: this device gave its seat back and asks like one
    // that never bought — it is the key pasted that puts it back.
    if (!(await isActivated(license.key, device))) {
      noteRequest(event, { license: "deactivated" })
      return Response.json({ error: "No licence yet." }, { status: 404 })
    }
    noteRequest(event, { license: "sent" })
    return {
      key: license.key,
      activation: await activationFor(license, device),
    }
  } catch (error) {
    console.error("[license] a paid order, but no licence could be issued", {
      order: order.code,
      error,
    })
    noteRequest(event, { license: "failed", error: String(error) })
    return Response.json(
      {
        error:
          "Your payment is recorded, but the licence could not be issued yet. We are on it.",
      },
      { status: 500 }
    )
  }
})
