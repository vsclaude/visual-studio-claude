/**
 * Vey Pro in main: this device's id, checking an activation's signature,
 * where the activation and its key are kept, and the three things the server
 * is asked — the licence a purchase on this device bought, a pasted key put on
 * this device, and this device taken off its key.
 *
 * `shared/license.ts` has the shape and the argument. What is here needs
 * Node's `crypto` (Ed25519, a UUID) or the store, and nothing else — free of
 * `electron`, so `test/license.ts` can sign an activation with a throwaway
 * pair and check it against the same code the app runs.
 */

import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto"

import {
  formatActivation,
  LICENSE_PUBLIC_KEY,
  parseActivation,
  proStatusOf,
  toBase64Url,
  type ActivationPayload,
  type LicenseResult,
  type ProStatus,
} from "../shared/license"

/**
 * The settings keys. `pro.` so they read as one thing in `manifest.json`.
 * `pro.license` (the Google era's `VEY1` key) and `pro.trialStartedAt` from
 * before are left where they are and read by nothing.
 */
export const ACTIVATION_SETTING = "pro.activation"
export const KEY_SETTING = "pro.key"
/**
 * This device's id: a random UUID, minted the first time it is asked for. Its
 * own, not telemetry's `telemetry.installId` — a purchase and the anonymous
 * usage counts must never be joinable by an id they share.
 */
export const DEVICE_SETTING = "pro.device"

/** The reads and writes this module makes of the store. An empty string is
 * how a setting is cleared. */
export type LicenseStore = {
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
}

/** A call to the studio server — `serverCall` from `studio-server.ts`. */
export type LicenseCall = (
  method: "GET" | "POST",
  route: string,
  body?: unknown
) => Promise<
  { ok: true; json: unknown } | { ok: false; error: string; status?: number }
>

export async function deviceId(store: LicenseStore): Promise<string> {
  const stored = await store.getSetting(DEVICE_SETTING)
  if (stored) return stored
  const minted = randomUUID()
  await store.setSetting(DEVICE_SETTING, minted)
  return minted
}

/**
 * The payload an activation carries, if its signature is the server's **and**
 * it is for `device` **and** it has not ended — null for one that is
 * malformed, signed by something else, tampered with, copied here from another
 * machine, or a campaign's licence past its `expiresAt`. The end is read off
 * this machine's clock: offline is the whole point, and the launch's check-in
 * is a 410 from the server's clock for one wound back.
 *
 * The raw 32-byte public key is wrapped in the SPKI prefix Node wants rather
 * than shipped as PEM: one base64 constant in `shared/license.ts` is easier
 * to read against the server's than a five-line block.
 */
export function verifyActivation(
  activation: string,
  device: string,
  publicKey: string = LICENSE_PUBLIC_KEY,
  now: Date = new Date()
): ActivationPayload | null {
  const parsed = parseActivation(activation)
  if (!parsed || parsed.payload.device !== device) return null
  const { expiresAt } = parsed.payload
  if (expiresAt && Date.parse(expiresAt) <= +now) return null
  try {
    const ok = verify(
      null,
      Buffer.from(parsed.signed, "base64url"),
      createPublicKey({
        key: Buffer.concat([
          ED25519_SPKI_PREFIX,
          Buffer.from(publicKey, "base64"),
        ]),
        format: "der",
        type: "spki",
      }),
      Buffer.from(parsed.signature, "base64url")
    )
    return ok ? parsed.payload : null
  } catch {
    return null
  }
}

/** DER for `SubjectPublicKeyInfo { id-Ed25519, BIT STRING (32 bytes) }`. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")

/**
 * An activation for `payload`, signed with the server's private key (PKCS#8
 * PEM).
 *
 * The server's half, kept here as well so the test signs in the same format
 * that verifies — the server signs through WebCrypto, which Cloudflare's
 * runtime has, and `vsclaude-cloud/test/license.test.ts` checks its output
 * against `verifyActivation` above.
 */
export function signActivation(
  payload: ActivationPayload,
  privateKeyPem: string
): string {
  const signed = toBase64Url(JSON.stringify(payload))
  const signature = sign(
    null,
    Buffer.from(signed, "base64url"),
    createPrivateKey(privateKeyPem)
  )
  return formatActivation(signed, signature.toString("base64url"))
}

/** Where this device stands: an activation that verifies for it, or Free. */
export async function proStatus(store: LicenseStore): Promise<ProStatus> {
  const activation = await store.getSetting(ACTIVATION_SETTING)
  if (!activation) return { kind: "free" }
  const payload = verifyActivation(activation, await deviceId(store))
  return proStatusOf(payload, (await store.getSetting(KEY_SETTING)) || null)
}

/**
 * Keeps what the server answered a licence with — `{ key, activation }` —
 * once the activation verifies for this device. Thrown rather than dropped
 * when it does not: this is somebody who has paid, and the one cause is the
 * server signing with a key whose public half is not `LICENSE_PUBLIC_KEY` —
 * silence here was a purchase that did nothing and said nothing.
 */
async function keep(store: LicenseStore, json: unknown): Promise<void> {
  const fields = (json ?? {}) as { key?: unknown; activation?: unknown }
  const activation =
    typeof fields.activation === "string" ? fields.activation : ""
  if (!verifyActivation(activation, await deviceId(store))) {
    throw new Error(
      "Your purchase went through, but the licence the server sent could not be verified by this version of Vey Studio. Update the app, or reply to your licence email with its order code."
    )
  }
  await store.setSetting(ACTIVATION_SETTING, activation)
  if (typeof fields.key === "string") {
    await store.setSetting(KEY_SETTING, fields.key)
  }
}

async function forget(store: LicenseStore): Promise<void> {
  await store.setSetting(ACTIVATION_SETTING, "")
  await store.setSetting(KEY_SETTING, "")
}

/**
 * Asks the server where this device stands, and keeps the answer.
 *
 * - **With a key**, it is put on this device again (`POST
 *   /api/license/activate`, idempotent for a device already on it). That is
 *   the launch's check-in: a key refunded since (410) or never issued (404)
 *   is forgotten here, and nothing else ends a licence. Offline, or any other
 *   failure, keeps what is held — the activation verifies on its own.
 * - **Without one**, the licence a purchase made on this device bought, once
 *   its transfer has landed (`GET /api/license?device=`) — what the window
 *   asks while a checkout it opened is waiting, and on focus. 404 is "not
 *   yet" and changes nothing.
 */
export async function claimLicense(
  store: LicenseStore,
  call: LicenseCall
): Promise<ProStatus> {
  const device = await deviceId(store)
  const key = await store.getSetting(KEY_SETTING)
  if (key) {
    const answer = await call("POST", "/api/license/activate", { key, device })
    if (answer.ok) await keep(store, answer.json)
    else if (answer.status === 404 || answer.status === 410) {
      await forget(store)
    }
    return proStatus(store)
  }
  const answer = await call(
    "GET",
    `/api/license?device=${encodeURIComponent(device)}`
  )
  if (answer.ok) await keep(store, answer.json)
  return proStatus(store)
}

/** A key pasted into the Pro dialog, put on this device. */
export async function activateLicense(
  store: LicenseStore,
  call: LicenseCall,
  key: string
): Promise<LicenseResult> {
  const answer = await call("POST", "/api/license/activate", {
    key,
    device: await deviceId(store),
  })
  if (!answer.ok) return { ok: false, error: answer.error }
  try {
    await keep(store, answer.json)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  return { ok: true, status: await proStatus(store) }
}

/**
 * This device taken off its key, freeing the seat for another — the server
 * first, so a seat is never thought free while still held. A key the server
 * no longer knows is forgotten here all the same.
 */
export async function deactivateLicense(
  store: LicenseStore,
  call: LicenseCall
): Promise<LicenseResult> {
  const key = await store.getSetting(KEY_SETTING)
  if (key) {
    const answer = await call("POST", "/api/license/deactivate", {
      key,
      device: await deviceId(store),
    })
    if (!answer.ok && answer.status !== 404 && answer.status !== 410) {
      return { ok: false, error: answer.error }
    }
  }
  await forget(store)
  return { ok: true, status: await proStatus(store) }
}
