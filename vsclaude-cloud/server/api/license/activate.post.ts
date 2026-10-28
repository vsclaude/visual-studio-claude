import { defineHandler } from "nitro"

import {
  activate,
  activationsOf,
  campaignCodeOf,
  getCampaign,
  getLicense,
  hasExpired,
  redeem,
  type License,
} from "../../utils/accounts.ts"
import {
  activationFor,
  newLicenseKey,
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
 * many; a refunded or ended one a 410, which is how the app learns to drop it.
 *
 * **Or a campaign's code**, typed into the same field: what is not a key is
 * looked up in `campaigns`, and redeeming it makes this device a licence of
 * its own (`redeem`) whose key comes back like any other — so the check-in
 * after is the key's, and ends it when it runs out. One per device per
 * campaign; a full or closed campaign is a 410.
 */
export default defineHandler(async (event) => {
  const fields = await fieldsOf(event.req)
  if (fields instanceof Response) return fields
  const device = fields.device
  if (!validDevice(device)) {
    noteRequest(event, { refused: "no device" })
    return Response.json({ error: "No device." }, { status: 400 })
  }

  const key = normalizeLicenseKey(fields.key)
  let license: License | null
  if (key) {
    license = await getLicense(key)
    if (!license) {
      noteRequest(event, { refused: "no such key" })
      return Response.json(
        { error: "That licence key is not one we issued." },
        { status: 404 }
      )
    }
  } else {
    const code = campaignCodeOf(fields.key)
    const campaign = code ? await getCampaign(code) : null
    if (!campaign) {
      noteRequest(event, { refused: "not a key or a code" })
      return Response.json(
        { error: "That is not a Vey Pro licence key or a promo code." },
        { status: 400 }
      )
    }
    if (campaign.endsAt && Date.parse(campaign.endsAt) <= Date.now()) {
      noteRequest(event, { refused: "campaign over", campaign: campaign.code })
      return Response.json(
        { error: "That promo code has ended." },
        { status: 410 }
      )
    }
    license = await redeem(campaign, device, newLicenseKey())
    if (!license) {
      noteRequest(event, { refused: "campaign full", campaign: campaign.code })
      return Response.json(
        { error: "That promo code has been used up." },
        { status: 410 }
      )
    }
    noteRequest(event, { redeemed: campaign.code })
  }

  if (license.revoked) {
    noteRequest(event, { refused: "revoked" })
    return Response.json(
      { error: "This licence was refunded." },
      { status: 410 }
    )
  }
  if (hasExpired(license)) {
    noteRequest(event, { refused: "expired" })
    return Response.json(
      { error: `This licence ended on ${license.expiresAt!.slice(0, 10)}.` },
      { status: 410 }
    )
  }
  if (!(await activate(license, device))) {
    noteRequest(event, { refused: "seats full", seats: license.seats })
    return Response.json(
      {
        error: `This key is already on ${license.seats} ${license.seats === 1 ? "device" : "devices"}. Deactivate one of them in its Vey Pro dialog first.`,
        seats: license.seats,
        devices: (await activationsOf(license.key)).length,
      },
      { status: 409 }
    )
  }
  noteRequest(event, {
    activated: license.key.slice(-4),
    seats: license.seats,
  })
  return {
    key: license.key,
    activation: await activationFor(license, device),
  }
})
