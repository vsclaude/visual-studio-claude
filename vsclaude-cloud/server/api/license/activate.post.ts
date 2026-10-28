import { defineHandler } from "nitro"

import { activate, activationsOf, getLicense } from "../../utils/accounts.ts"
import {
  activationFor,
  normalizeLicenseKey,
  validDevice,
} from "../../utils/license.ts"
import { noteRequest } from "../../utils/log.ts"
import { fieldsOf } from "../../utils/request.ts"

/**
 * `POST /api/license/activate` `{ key, device }` — puts a licence key on a
 * device, answered `{ key, activation }`: the key pasted on a second machine,
 * and every launch of a licensed app checking in, which is idempotent for a
 * device already on the key. A key with every seat taken is a 409 naming how
 * many; a refunded one a 410, which is how the app learns to drop it.
 */
export default defineHandler(async (event) => {
  const fields = await fieldsOf(event.req)
  if (fields instanceof Response) return fields
  const key = normalizeLicenseKey(fields.key)
  const device = fields.device
  if (!key || !validDevice(device)) {
    noteRequest(event, { refused: !key ? "not a key" : "no device" })
    return Response.json(
      { error: "That is not a Vey Pro licence key." },
      { status: 400 }
    )
  }

  const license = await getLicense(key)
  if (!license) {
    noteRequest(event, { refused: "no such key" })
    return Response.json(
      { error: "That licence key is not one we issued." },
      { status: 404 }
    )
  }
  if (license.revoked) {
    noteRequest(event, { refused: "revoked" })
    return Response.json(
      { error: "This licence was refunded." },
      { status: 410 }
    )
  }
  if (!(await activate(license, device))) {
    noteRequest(event, { refused: "seats full", seats: license.seats })
    return Response.json(
      {
        error: `This key is already on ${license.seats} ${license.seats === 1 ? "device" : "devices"}. Deactivate one of them in its Vey Pro dialog first.`,
        seats: license.seats,
        devices: (await activationsOf(key)).length,
      },
      { status: 409 }
    )
  }
  noteRequest(event, { activated: key.slice(-4), seats: license.seats })
  return { key, activation: await activationFor(license, device) }
})
