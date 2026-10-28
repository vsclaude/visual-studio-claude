import { generateKeyPairSync } from "node:crypto"

import {
  activateLicense,
  ACTIVATION_SETTING,
  claimLicense,
  deactivateLicense,
  DEVICE_SETTING,
  deviceId,
  KEY_SETTING,
  proStatus,
  signActivation,
  verifyActivation,
  type LicenseCall,
  type LicenseStore,
} from "../src/main/license"
import {
  canAddProject,
  parseActivation,
  proStatusOf,
  PRO_PLANS,
} from "../src/shared/license"
import { check, finish, section } from "./harness"

/**
 * Vey Pro per device: an activation's shape and signature, that it is this
 * device's and no other's, where a device stands, the gate on a second
 * project — and the three calls to the server, against a stand-in that
 * answers the way `vsclaude-cloud`'s routes do. Signed with a throwaway pair
 * rather than the shipped public key, since the private half of that is the
 * server's alone — so an activation the stand-in hands back is one the app
 * must refuse, which is the refusal tested.
 */

const pair = generateKeyPairSync("ed25519")
const privatePem = String(
  pair.privateKey.export({ type: "pkcs8", format: "pem" })
)
const publicRaw = pair.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64")

const DEVICE = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b"
const KEY = "VEY-AB12-CD34-EF56-GH78"
const payload = {
  email: "a@b.vn",
  seats: 3,
  device: DEVICE,
  issuedAt: "2026-10-28T00:00:00.000Z",
}
const activation = signActivation(payload, privatePem)

section("the activation")
check("is three parts under VEY2", /^VEY2\.[\w-]+\.[\w-]+$/.test(activation))
check(
  "parses to its payload",
  JSON.stringify(parseActivation(activation)?.payload) ===
    JSON.stringify(payload)
)
check("a word is not one", parseActivation("hello") === null)
check(
  "the Google era's VEY1 key is not one",
  parseActivation(activation.replace(/^VEY2/, "VEY1")) === null
)
check(
  "verifies for its own device",
  verifyActivation(activation, DEVICE, publicRaw)?.seats === 3
)
check(
  "and is nothing on another",
  verifyActivation(
    activation,
    "00000000-0000-4000-8000-000000000000",
    publicRaw
  ) === null
)
check(
  "and not against the shipped key",
  verifyActivation(activation, DEVICE) === null
)
{
  const [prefix, , signature] = activation.split(".")
  const forged = Buffer.from(JSON.stringify({ ...payload, seats: 5 })).toString(
    "base64url"
  )
  check(
    "an edited payload is refused",
    verifyActivation(`${prefix}.${forged}.${signature}`, DEVICE, publicRaw) ===
      null
  )
}

section("where a device stands")
{
  const licensed = proStatusOf(payload, KEY)
  check(
    "an activation is licensed, with its seats and key",
    licensed.kind === "licensed" && licensed.seats === 3 && licensed.key === KEY
  )
  check("no activation is free", proStatusOf(null, null).kind === "free")
}

section("the gate")
{
  const free = { kind: "free" as const }
  const licensed = { kind: "licensed" as const, email: "", seats: 1, key: null }
  check("Free adds its first project", canAddProject(free, []))
  check("and not a second", !canAddProject(free, [{}]))
  check(
    "a worktree is not a project",
    canAddProject(free, [{ worktreeOf: "p" }])
  )
  check("Pro adds any number", canAddProject(licensed, [{}, {}, {}]))
}

section("the plans")
check(
  "one, three and five devices, dearer for more",
  PRO_PLANS.map((plan) => plan.seats).join() === "1,3,5" &&
    PRO_PLANS.every(
      (plan, index) => index === 0 || plan.price > PRO_PLANS[index - 1]!.price
    )
)

/** A store in memory, and a server answering every call with `answer`. */
function setup(answer: { status: number; json?: unknown }) {
  const settings = new Map<string, string>()
  const store: LicenseStore = {
    getSetting: async (k) => settings.get(k) ?? null,
    setSetting: async (k, v) => void settings.set(k, v),
  }
  const calls: string[] = []
  const call: LicenseCall = async (method, route) => {
    calls.push(`${method} ${route.split("?")[0]}`)
    return answer.status < 300
      ? { ok: true, json: answer.json ?? null }
      : { ok: false, error: `answered ${answer.status}`, status: answer.status }
  }
  /** As if this device were already on the key. */
  const hold = () => {
    settings.set(KEY_SETTING, KEY)
    settings.set(ACTIVATION_SETTING, activation)
  }
  return { settings, store, call, calls, hold }
}

section("the device")
{
  const { store, settings } = setup({ status: 404 })
  const first = await deviceId(store)
  check(
    "is a UUID, minted once and kept",
    /^[0-9a-f-]{36}$/.test(first) &&
      (await deviceId(store)) === first &&
      settings.get(DEVICE_SETTING) === first
  )
  check("and is not telemetry's", !settings.has("telemetry.installId"))
  check("a new device is free", (await proStatus(store)).kind === "free")
  settings.set("pro.license", "VEY1.old.key")
  check(
    "the Google era's key is not Pro",
    (await proStatus(store)).kind === "free"
  )
}

section("claiming")
{
  const { store, call, calls } = setup({ status: 404 })
  check(
    "with no purchase yet, nothing changes",
    (await claimLicense(store, call)).kind === "free" &&
      calls.join() === "GET /api/license"
  )
}
{
  const { store, settings, call } = setup({
    status: 200,
    json: { key: KEY, activation },
  })
  const thrown = await claimLicense(store, call).then(
    () => "",
    (error: Error) => error.message
  )
  check(
    "an activation the shipped key did not sign is refused out loud",
    thrown.includes("could not be verified") &&
      !settings.has(ACTIVATION_SETTING)
  )
}
{
  const { store, settings, call, calls, hold } = setup({ status: 410 })
  hold()
  await claimLicense(store, call)
  check(
    "with a key, it checks in rather than asking for a purchase",
    calls.join() === "POST /api/license/activate"
  )
  check(
    "and a refunded key is forgotten",
    !settings.get(KEY_SETTING) && !settings.get(ACTIVATION_SETTING)
  )
}
{
  const { store, settings, call, hold } = setup({ status: 503 })
  hold()
  await claimLicense(store, call)
  check(
    "a server that is down takes nothing away",
    settings.get(KEY_SETTING) === KEY &&
      settings.get(ACTIVATION_SETTING) === activation
  )
}

section("activating and deactivating")
{
  const { store, call } = setup({ status: 409 })
  const result = await activateLicense(store, call, KEY)
  check(
    "a key with every seat taken says so",
    !result.ok && result.error === "answered 409"
  )
}
{
  const { store, settings, call, calls, hold } = setup({ status: 204 })
  hold()
  const result = await deactivateLicense(store, call)
  check(
    "deactivating asks the server, then forgets the licence",
    result.ok &&
      result.status.kind === "free" &&
      calls.join() === "POST /api/license/deactivate" &&
      !settings.get(KEY_SETTING)
  )
}
{
  const { store, settings, call, hold } = setup({ status: 503 })
  hold()
  const result = await deactivateLicense(store, call)
  check(
    "but not when the server could not free the seat",
    !result.ok && settings.get(KEY_SETTING) === KEY
  )
}

finish()
