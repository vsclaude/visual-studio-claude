import { generateKeyPairSync } from "node:crypto"
import { describe, expect, test } from "bun:test"

import { verifyActivation } from "../../src/main/license.ts"
import { PRO_PLANS as APP_PLANS } from "../../src/shared/license.ts"
import { PRO_PLANS } from "../server/utils/billing.ts"
import {
  newLicenseKey,
  normalizeLicenseKey,
  pemBytes,
  signActivation,
  validDevice,
} from "../server/utils/license.ts"

/**
 * An activation signed here is one the app reads: the two `signActivation`s
 * are hand-kept copies, and this is what keeps them the same. The app's
 * verifier is imported from the app itself, with a throwaway pair's public
 * half in place of the one the app ships.
 */

const pair = generateKeyPairSync("ed25519")
const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" })
const publicRaw = pair.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64")

const DEVICE = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b"
const payload = {
  email: "a@b.vn",
  seats: 3,
  device: DEVICE,
  issuedAt: "2026-10-28T00:00:00.000Z",
}

describe("an activation the server signs", () => {
  test("verifies in the app, for its own device", async () => {
    const activation = await signActivation(payload, String(privatePem))
    expect(activation.startsWith("VEY2.")).toBe(true)
    expect(verifyActivation(activation, DEVICE, publicRaw)).toEqual(payload)
  })
  test("is nothing on another device", async () => {
    const activation = await signActivation(payload, String(privatePem))
    expect(
      verifyActivation(
        activation,
        "00000000-0000-4000-8000-000000000000",
        publicRaw
      )
    ).toBeNull()
  })
  test("does not verify against another key", async () => {
    const other = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64")
    const activation = await signActivation(payload, String(privatePem))
    expect(verifyActivation(activation, DEVICE, other)).toBeNull()
  })
  test("a payload edited after signing is refused", async () => {
    const activation = await signActivation(payload, String(privatePem))
    const [prefix, , signature] = activation.split(".")
    const forged = Buffer.from(
      JSON.stringify({ ...payload, seats: 5 })
    ).toString("base64url")
    expect(
      verifyActivation(`${prefix}.${forged}.${signature}`, DEVICE, publicRaw)
    ).toBeNull()
  })
})

describe("licence keys", () => {
  test("are VEY- and four groups of four, and read back as themselves", () => {
    for (let i = 0; i < 50; i++) {
      const key = newLicenseKey()
      expect(key).toMatch(
        /^VEY-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/
      )
      expect(normalizeLicenseKey(key)).toBe(key)
    }
  })
  test("as typed: any case, spaces, no dashes, O for 0 and I for 1", () => {
    expect(normalizeLicenseKey(" vey ab12 cd34 ef56 gh78 ")).toBe(
      "VEY-AB12-CD34-EF56-GH78"
    )
    expect(normalizeLicenseKey("AB12CD34EF56GH78")).toBe(
      "VEY-AB12-CD34-EF56-GH78"
    )
    expect(normalizeLicenseKey("VEY-ABI2-CD34-EF56-GH7O")).toBe(
      "VEY-AB12-CD34-EF56-GH70"
    )
  })
  test("anything else is not one", () => {
    expect(normalizeLicenseKey("VEY-AB12")).toBeNull()
    expect(normalizeLicenseKey("VEY1.abc.def")).toBeNull()
    expect(normalizeLicenseKey(42)).toBeNull()
  })
})

test("a device is the app's UUID and nothing else", () => {
  expect(validDevice(DEVICE)).toBe(true)
  expect(validDevice("google:123")).toBe(false)
  expect(validDevice("")).toBe(false)
})

describe("the private key, however it was pasted", () => {
  const pem = String(privatePem)
  const der = pemBytes(pem)
  const pasted: [string, string][] = [
    ["inside the quotes of a .env line", `"${pem}"`],
    ["with its newlines written as \\n", pem.replace(/\n/g, "\\n")],
    ["escaped twice", pem.replace(/\n/g, "\\\\n")],
    ["with Windows line ends", pem.replace(/\n/g, "\r\n")],
    ["on one line, spaces for newlines", pem.replace(/\n/g, " ")],
  ]
  test("is 48 bytes of DER", () => {
    expect(der.length).toBe(48)
  })
  for (const [how, secret] of pasted) {
    test(how, async () => {
      expect(pemBytes(secret)).toEqual(der)
      const activation = await signActivation(payload, secret)
      expect(verifyActivation(activation, DEVICE, publicRaw)?.email).toBe(
        "a@b.vn"
      )
    })
  }
})

test("the plans the server charges are the ones the app shows", () => {
  expect(PRO_PLANS.map(({ seats, price }) => ({ seats, price }))).toEqual(
    APP_PLANS.map(({ seats, price }) => ({ seats, price }))
  )
})
