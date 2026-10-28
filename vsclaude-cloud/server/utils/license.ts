import { useRuntimeConfig } from "nitro/runtime-config"

import {
  activate,
  addLicense,
  licenseOfOrder,
  type License,
} from "./accounts.ts"
import { planOf } from "./billing.ts"
import type { Order } from "./sepay-billing.ts"

/**
 * Vey Pro's two artefacts, now that nobody signs in.
 *
 * **The licence key** — `VEY-XXXX-XXXX-XXXX-XXXX`, made when an order is paid
 * and mailed to the buyer. Random, not signed: it is a name for a row of
 * `licenses`, read out of an email and typed or pasted into the app on each
 * device, so it is short and in an alphabet with no `0`/`O` or `1`/`I` to
 * mistake. Its seats (one, three or five) are on the row.
 *
 * **The activation** — `VEY2.<payload>.<signature>`, what the app keeps once
 * a key is on it. The payload is who bought it, how many seats, the device
 * it is for and when it ends (null for bought, which is for good); the signature Ed25519 over those payload bytes, base64url,
 * by `NITRO_LICENSE_PRIVATE_KEY`. The app checks it offline against the
 * public half (`LICENSE_PUBLIC_KEY` in its `src/shared/license.ts`) **and**
 * against its own device id, so an activation copied to another machine is
 * nothing there. The format is the app's `signActivation`
 * (`src/main/license.ts`) too, kept in step by `test/license.test.ts`.
 *
 * **WebCrypto, not `node:crypto`.** The app signs with Node's `sign`, and so
 * did this, which passed every test under Bun and signed nothing on Cloudflare:
 * the Workers runtime's `node:crypto` is a partial port, and Ed25519 through it
 * is not something to bet a payment on. `crypto.subtle` with `Ed25519` is the
 * runtime's own, and Bun's and Node's too.
 */

export type ActivationPayload = {
  /** Who it was sold to, for the dialog to say. Empty when not known. */
  email: string
  /** How many devices the key it came from is for. */
  seats: number
  /** The app's device id this is for. */
  device: string
  /** ISO. */
  issuedAt: string
  /** ISO, when the licence ends — a campaign's; null for one bought, which
   * does not. The app goes back to Free past it, offline. */
  expiresAt: string | null
}

const ACTIVATION_PREFIX = "VEY2"

export async function signActivation(
  payload: ActivationPayload,
  privateKeyPem: string
): Promise<string> {
  const message = new TextEncoder().encode(JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(privateKeyPem),
    { name: "Ed25519" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, message)
  return `${ACTIVATION_PREFIX}.${base64url(message)}.${base64url(new Uint8Array(signature))}`
}

/** The activation for a key on a device, as of now. */
export function activationFor(
  license: License,
  device: string
): Promise<string> {
  return signActivation(
    {
      email: license.email ?? "",
      seats: license.seats,
      device,
      issuedAt: new Date().toISOString(),
      expiresAt: license.expiresAt,
    },
    licensePrivateKey()
  )
}

/** Crockford's base32, less the letters it leaves out: nothing to misread. */
const KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** A new licence key — 80 random bits in four groups of four. */
export function newLicenseKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const chars = Array.from(bytes, (byte) => KEY_ALPHABET[byte % 32]!)
  const groups = [0, 4, 8, 12].map((at) => chars.slice(at, at + 4).join(""))
  return `VEY-${groups.join("-")}`
}

/**
 * A key as somebody typed or pasted it, in the form it is stored: upper-cased,
 * spaces and stray dashes gone, the letters Crockford reads as digits read as
 * them. Null for anything that is not one.
 */
export function normalizeLicenseKey(input: unknown): string | null {
  if (typeof input !== "string") return null
  const plain = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
  const body = plain.startsWith("VEY") ? plain.slice(3) : plain
  if (!new RegExp(`^[${KEY_ALPHABET}]{16}$`).test(body)) return null
  return `VEY-${body.match(/.{4}/g)!.join("-")}`
}

/** A device id as the app sends it: its own random UUID, nothing else. */
export function validDevice(input: unknown): input is string {
  return (
    typeof input === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input
    )
  )
}

/**
 * The key for a paid order, made the first time it is asked for, with the
 * device the order was opened on put on it — the webhook's second half, and
 * `GET /api/license`'s way of finishing it when the webhook did not: an order
 * marked paid whose key was never made (a signing that threw, a write that
 * failed) is somebody who paid for nothing, and SePay will not deliver that
 * transfer again. Null for an order that buys nothing.
 *
 * The device is put on only when the key is made, never again: an order's
 * device that has since pressed `Deactivate this device` is off it for good,
 * and putting it back on every ask was the app's next focus re-activating it
 * seconds after it was freed. Back on is the key pasted, like any device.
 */
export async function grantLicense(order: Order): Promise<License | null> {
  const plan = planOf(order.item)
  if (!plan) return null
  const made = await licenseOfOrder(order.code)
  if (made) return made
  const license = await addLicense({
    key: newLicenseKey(),
    email: order.email,
    seats: plan.seats,
    order: order.code,
  })
  if (order.device) await activate(license, order.device)
  return license
}

/**
 * A PEM block's DER bytes, out of a secret however it was pasted.
 *
 * The first deploy's `NITRO_LICENSE_PRIVATE_KEY` failed `atob` on every
 * signing: a secret pasted into a dashboard field arrives with whatever came
 * with it — the quotes around a `.env` line, its newlines written as `\\n`
 * (once or twice escaped), Windows line ends. Only what lies between the
 * markers is the key, and only the base64 alphabet is the key's; the escapes
 * go before the sweep, or their `n` would stay behind as a base64 letter.
 */
export function pemBytes(pem: string): Uint8Array<ArrayBuffer> {
  const unescaped = pem.replace(/\\+[nr]/g, "\n")
  const body =
    unescaped.match(
      /-----BEGIN [A-Z ]+-----([\s\S]*?)-----END [A-Z ]+-----/
    )?.[1] ?? unescaped
  const base64 = body.replace(/[^A-Za-z0-9+/=]/g, "")
  if (!base64) throw new Error("NITRO_LICENSE_PRIVATE_KEY has no key in it.")
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * The private key, PKCS#8 PEM, from `NITRO_LICENSE_PRIVATE_KEY`, as it was
 * set — `pemBytes` is what reads past how it was pasted.
 */
export function licensePrivateKey(): string {
  return String(useRuntimeConfig().licensePrivateKey ?? "")
}

/**
 * Whether Pro can be sold at all: a key that reads as one. An Ed25519 key in
 * PKCS#8 is 48 bytes of DER, and checking that here rather than the word
 * `PRIVATE KEY` is what refuses the checkout before somebody pays, instead of
 * after — the first deploy sold Pro on a secret no signing could read.
 */
export function licenseReady(): boolean {
  try {
    return pemBytes(licensePrivateKey()).length === ED25519_PKCS8_BYTES
  } catch {
    return false
  }
}

const ED25519_PKCS8_BYTES = 48
