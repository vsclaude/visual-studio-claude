/**
 * Vey Pro: the one thing in this studio that is sold.
 *
 * Free is **every account Anthropic signs in** — claude.ai plans, Console,
 * SSO, as many as somebody has — `Continue with …` between them, and custom
 * API endpoints (`main/claude-api.ts`) — in **one project**. Pro is **every
 * project after it** (`canAddProject`; on Free the rest are locked,
 * `lockedFolderIds`). It was the second account first, then
 * the custom API; the first gated the reason anybody installs this app and the
 * second sold to too few (`docs/design.md` § Pro has all three).
 * Bought once, by bank transfer, never a subscription.
 *
 * **No trial.** There were thirty days of Pro on every install; they were
 * taken out on 2026-10-28 — Free is already the whole product for anybody on
 * Anthropic's own accounts, and the price is low enough to try by buying. A
 * `pro.trialStartedAt` an older build wrote stays in the manifest and nothing
 * reads it.
 *
 * **No sign-in; a licence is per device.** A purchase is one, three or five
 * devices (`PRO_PLANS`), and makes a **licence key** — `VEY-XXXX-XXXX-XXXX-
 * XXXX`, mailed to the buyer — with the device it was bought on already on it.
 * Another device is the key pasted into its Pro dialog; a seat comes back by
 * deactivating a device in the same place. Pro used to belong to the Google
 * account that paid, and that sign-in is deleted (`docs/design.md` § Pro).
 *
 * **What this device keeps is an activation, checked here.** `VEY2.<payload>.
 * <signature>`: the email, the seats and **this device's id**, signed by the
 * server with an Ed25519 key whose public half is `LICENSE_PUBLIC_KEY` below.
 * Verified in main (`main/license.ts`, Node's `crypto`) against the signature
 * and the device; this file only knows the shape. Offline every time: a
 * licence that stops working when a server is down is a licence somebody paid
 * for and does not have. The app checks in at launch, which is how a refunded
 * key ends — the one thing a server is asked for on a licence already held.
 *
 * Pure and shared. `test/license.ts`.
 */

/**
 * The plans: one, three or five devices, each bought once. Must match the
 * server's `PRO_PLANS` (`vsclaude-cloud/server/utils/billing.ts`) —
 * `vsclaude-cloud/test/license.test.ts` compares them.
 */
export const PRO_PLANS: readonly { seats: number; price: number }[] = [
  // TEMPORARY (2026-10-28): 2.000 ₫ to test a real purchase end to end. The
  // price is 99_000 — put it back here and in the server's `PRO_PLANS` together.
  { seats: 1, price: 2_000 },
  { seats: 3, price: 199_000 },
  { seats: 5, price: 299_000 },
]

/** The plan the Pro dialog marks as the one most people want. */
export const POPULAR_SEATS = 3

/** Days a purchase can be refunded in, by replying to its mail. */
export const REFUND_DAYS = 7

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

/** A price as the checkout will show it — `99.000 ₫`. */
export function formatPrice(price: number): string {
  return VND.format(price)
}

/** What a buy click came to: a browser opened, or why not. */
export type PurchaseResult = { ok: true } | { ok: false; error: string }

/** What pasting a key, or taking this device off one, came to. */
export type LicenseResult =
  { ok: true; status: ProStatus } | { ok: false; error: string }

/**
 * The public half of the server's signing key, raw Ed25519 (32 bytes) in
 * base64. The private half is the server's alone (`vsclaude-cloud`,
 * `NITRO_LICENSE_PRIVATE_KEY`); an activation signed by anything else is not
 * a licence.
 */
export const LICENSE_PUBLIC_KEY = "49iqcUsM6xlV7JpAkFAlqk3ojTjoiMeOK8Il9LLOg5s="

const ACTIVATION_PREFIX = "VEY2"

/** What the server signs for a device a key is on. */
export type ActivationPayload = {
  /** Who bought the key, for the dialog to say. Empty when not known. */
  email: string
  /** How many devices the key is for. */
  seats: number
  /** The device id it is for — `main/license.ts`'s `deviceId`. */
  device: string
  /** ISO. */
  issuedAt: string
}

/** The parts of an activation — the bytes that were signed, and the
 * signature. */
export type ParsedActivation = {
  payload: ActivationPayload
  /** The payload exactly as signed, base64url. */
  signed: string
  /** base64url. */
  signature: string
}

/**
 * `VEY2.<payload>.<signature>` taken apart, or null for anything that is not
 * shaped like one. Only the shape — whether the signature is real, and the
 * device this one, is `verifyActivation`'s (`main/license.ts`), which needs
 * `crypto`.
 */
export function parseActivation(input: string): ParsedActivation | null {
  const parts = input.replace(/\s+/g, "").split(".")
  if (parts.length !== 3 || parts[0] !== ACTIVATION_PREFIX) return null
  const [, signed, signature] = parts as [string, string, string]
  if (!signed || !signature) return null
  let payload: unknown
  try {
    payload = JSON.parse(fromBase64Url(signed))
  } catch {
    return null
  }
  if (!isPayload(payload)) return null
  return { payload, signed, signature }
}

/** The activation the server writes for a payload it has signed. */
export function formatActivation(signed: string, signature: string): string {
  return `${ACTIVATION_PREFIX}.${signed}.${signature}`
}

function isPayload(value: unknown): value is ActivationPayload {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.email === "string" &&
    typeof record.seats === "number" &&
    typeof record.device === "string" &&
    typeof record.issuedAt === "string" &&
    !Number.isNaN(Date.parse(record.issuedAt))
  )
}

/** base64url → text, without `Buffer`, since the renderer parses these too. */
export function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0))
  )
}

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Where this device stands, as the dialog and the gate read it. `key` is the
 * licence key it was activated with, shown so it can be copied to another
 * device — null for one claimed by its purchase before the key was kept.
 */
export type ProStatus =
  | { kind: "licensed"; email: string; seats: number; key: string | null }
  | { kind: "free" }

/** `activation` is the verified payload of the stored one, or null. */
export function proStatusOf(
  activation: ActivationPayload | null,
  key: string | null
): ProStatus {
  return activation
    ? {
        kind: "licensed",
        email: activation.email,
        seats: activation.seats,
        key,
      }
    : { kind: "free" }
}

/** Whether Pro's features are on — a licence that verified. */
export function isPro(status: ProStatus): boolean {
  return status.kind !== "free"
}

/** How many projects Free holds. A worktree is a checkout of one, filed
 * inside it, and does not count. */
export const FREE_PROJECTS = 1

/** Whether one more project may be added. */
export function canAddProject(
  status: ProStatus,
  folders: readonly { worktreeOf?: string }[]
): boolean {
  if (isPro(status)) return true
  return folders.filter((folder) => !folder.worktreeOf).length < FREE_PROJECTS
}

/**
 * The folders Free does not run: every project but the **first one added**
 * (`addedAt`, the manifest's order breaking a tie), with its worktrees. Empty
 * on Pro.
 *
 * It was a gate on adding alone, and that made a one-device key every device's
 * — activate, add twenty projects, deactivate, paste the key on the next
 * machine, and the first keeps all twenty; a refund kept them too. So a
 * device back on Free **locks** what is past its one project rather than
 * removing it: nothing is deleted, the rail still draws it, and Pro again
 * opens it. Not the rail's order: dragging another project to the top would
 * make Free every project in turn. A worktree whose project has left the
 * workspace counts as a project of its own, the way the rail draws it
 * (`projectsIn`).
 */
export function lockedFolderIds(
  status: ProStatus,
  folders: readonly { id: string; addedAt?: string; worktreeOf?: string }[]
): Set<string> {
  const locked = new Set<string>()
  if (isPro(status)) return locked
  const ids = new Set(folders.map((folder) => folder.id))
  const projectOf = (folder: { id: string; worktreeOf?: string }) =>
    folder.worktreeOf && ids.has(folder.worktreeOf)
      ? folder.worktreeOf
      : folder.id
  // A stable sort, so the manifest's order decides between two without a
  // date; a record missing one sorts last.
  const added = (folder: { addedAt?: string }) =>
    Date.parse(folder.addedAt ?? "") || Number.POSITIVE_INFINITY
  const open = new Set(
    folders
      .filter((folder) => projectOf(folder) === folder.id)
      .sort((a, b) => added(a) - added(b))
      .slice(0, FREE_PROJECTS)
      .map((folder) => folder.id)
  )
  for (const folder of folders) {
    if (!open.has(projectOf(folder))) locked.add(folder.id)
  }
  return locked
}

/** What a turn in a locked project is refused with (`lockedFolderIds`). */
export const LOCKED_PROJECT =
  "This project is locked on Free, which runs one project. Vey Pro opens every project again — nothing in this one was deleted."
