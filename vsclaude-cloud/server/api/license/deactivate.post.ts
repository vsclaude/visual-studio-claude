import { defineHandler } from "nitro"

import { deactivate } from "../../utils/accounts.ts"
import { normalizeLicenseKey, validDevice } from "../../utils/license.ts"
import { noteRequest } from "../../utils/log.ts"
import { fieldsOf } from "../../utils/request.ts"

/**
 * `POST /api/license/deactivate` `{ key, device }` — takes a licence key off
 * a device and frees its seat, answered `204`: a laptop replaced, a machine
 * given away. Only the device itself asks — it is the one holding both — and
 * a key that was not on it is the same answer.
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
  await deactivate(key, device)
  noteRequest(event, { deactivated: key.slice(-4) })
  return new Response(null, { status: 204 })
})
