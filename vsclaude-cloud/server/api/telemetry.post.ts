import { defineHandler } from "nitro"

import { appUsageOf, countryOf, recordAppUsage } from "../utils/app-usage.ts"
import { noteRequest } from "../utils/log.ts"

/**
 * `POST /api/telemetry` `{ installId, event, activeSeconds?, version, os,
 * arch }` — one of the studio's anonymous usage events, answered `204`.
 * No sign-in: see `app-usage.ts` for what is held instead.
 */
export default defineHandler(async (event) => {
  let body: unknown
  try {
    body = await event.req.json()
  } catch {
    return Response.json({ error: "The body is not JSON." }, { status: 400 })
  }
  const usage = appUsageOf(body)
  if (typeof usage === "string") {
    noteRequest(event, { refused: usage })
    return Response.json({ error: usage }, { status: 400 })
  }

  // `cf` is on the Worker's own request; the header is what a zone adds when
  // IP geolocation is on, and the only one of the two under `nitro dev`.
  const cf = (event.req as { cf?: { country?: unknown } }).cf
  const country =
    countryOf(cf?.country) ?? countryOf(event.req.headers.get("cf-ipcountry"))
  await recordAppUsage(usage, country)
  noteRequest(event, {
    event: usage.event,
    version: usage.version,
    os: usage.os,
  })
  return new Response(null, { status: 204 })
})
