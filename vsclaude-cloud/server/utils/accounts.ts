import { atomically, database, statement } from "./database.ts"
import type { Order } from "./sepay-billing.ts"

/**
 * What has been paid for and what it bought, in the D1 database
 * (`database.ts`). There is no sign-in: an order is a device and an email,
 * and what it buys is a key.
 *
 * - `transactions` — one row per purchase. A `sepay` row is keyed by the order
 *   code a bank transfer carries, written `pending` with the `item`, `amount`
 *   (`VND`), the buyer's `email` and the `device` it was opened on (its `uid`
 *   is `device:<id>`, the column being `NOT NULL` from when it was a user),
 *   and `paid` by the SePay transfer in `paid_by`, at `paid_at`. Transfers
 *   that fell short add up in `short_amount`; `short_by` is the last one, so
 *   SePay retrying the same webhook adds it once. `paddle` rows are the
 *   deleted card purchases of credits, kept for whoever reconciles them.
 * - `licenses` — one Vey Pro key per paid order (`order_code` is unique, so a
 *   webhook delivered twice makes one), with its `seats` and the `email` it
 *   was mailed to. `revoked_at` is a refund: set by hand, and the app drops
 *   the licence the next time it checks in.
 * - `activations` — the devices a key is on, at most its seats.
 *
 * This is money somebody paid: an order leaves `pending` in one statement
 * guarded on still being `pending`, so a webhook delivered twice pays it once.
 */

export async function getOrder(code: string): Promise<Order | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT uid, email, device, item, amount, paid_by, short_amount, created_at FROM transactions WHERE provider = 'sepay' AND id = ${code}`
  const row = rows[0]
  if (!row) return null
  return {
    code,
    uid: String(row.uid),
    email: text(row.email),
    device: text(row.device),
    item: String(row.item),
    amount: Number(row.amount),
    createdAt: String(row.created_at),
    paidBy: row.paid_by === null ? null : Number(row.paid_by),
    short: Number(row.short_amount),
  }
}

/** Opens a bank-transfer order; false when its code is already taken. */
export async function addOrder(order: Order): Promise<boolean> {
  const db = await database()
  const { rows = [] } =
    await db.sql`INSERT INTO transactions (provider, id, uid, email, device, status, item, amount, currency, created_at) VALUES ('sepay', ${order.code}, ${order.uid}, ${order.email}, ${order.device}, 'pending', ${order.item}, ${order.amount}, 'VND', ${order.createdAt}) ON CONFLICT (provider, id) DO NOTHING RETURNING id`
  return rows.length === 1
}

/** Notes a transfer that carried the order's code but not enough. */
export async function addShortfall(
  code: string,
  transfer: { id: number; amount: number }
): Promise<void> {
  const db = await database()
  await db.sql`UPDATE transactions SET short_amount = short_amount + ${transfer.amount}, short_by = ${transfer.id} WHERE provider = 'sepay' AND id = ${code} AND short_by IS NOT ${transfer.id}`
}

/** Marks the order paid by the transfer — once: an order already paid is
 * not paid again. True for the one delivery that did. */
export async function payOrder(
  order: Order,
  transferId: number
): Promise<boolean> {
  const [paid = 0] = await atomically(
    statement`UPDATE transactions SET status = 'paid', paid_by = ${transferId}, paid_at = ${new Date().toISOString()} WHERE provider = 'sepay' AND id = ${order.code} AND status = 'pending'`
  )
  return paid > 0
}

/** How long an unpaid order is reopened by a second press of Buy — long
 * enough to open a banking app and scan. */
export const HOLD_MS = 30 * 60_000

/** The device's own unpaid order for the item within `HOLD_MS`, if any —
 * what a second press of Buy reopens rather than opening a second order. Only
 * at `amount` and for the same `email`: an order opened before a price
 * change would reopen its page at the old price, which is what happened the
 * day Pro went to 99.000 ₫, and one for another address would mail the key to
 * the wrong person. */
export async function heldOrder(
  device: string,
  item: string,
  amount: number,
  email: string
): Promise<string | null> {
  const db = await database()
  const since = new Date(Date.now() - HOLD_MS).toISOString()
  const { rows = [] } =
    await db.sql`SELECT id FROM transactions WHERE provider = 'sepay' AND status = 'pending' AND device = ${device} AND item = ${item} AND amount = ${amount} AND email = ${email} AND created_at >= ${since} ORDER BY created_at DESC LIMIT 1`
  const id = rows[0]?.id
  return typeof id === "string" && id ? id : null
}

/** The latest paid order opened on the device, if any — what the app asks
 * after while it waits on a transfer. */
export async function paidOrderOn(device: string): Promise<Order | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT id FROM transactions WHERE provider = 'sepay' AND status = 'paid' AND device = ${device} ORDER BY paid_at DESC LIMIT 1`
  const id = rows[0]?.id
  return typeof id === "string" && id ? getOrder(id) : null
}

export type License = {
  key: string
  email: string | null
  seats: number
  revoked: boolean
}

/** The key made for an order, or null before one has been. */
export async function licenseOfOrder(code: string): Promise<License | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT key, email, seats, revoked_at FROM licenses WHERE order_code = ${code}`
  return licenseOf(rows[0])
}

export async function getLicense(key: string): Promise<License | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT key, email, seats, revoked_at FROM licenses WHERE key = ${key}`
  return licenseOf(rows[0])
}

/**
 * Keeps a new key for a paid order — or, for an order that has one already
 * (the webhook delivered twice, or racing `GET /api/license`), answers that
 * one: `order_code` is unique, so of two writers only one key is ever kept.
 */
export async function addLicense(license: {
  key: string
  email: string | null
  seats: number
  order: string
}): Promise<License> {
  const db = await database()
  await db.sql`INSERT INTO licenses (key, email, seats, order_code, issued_at) VALUES (${license.key}, ${license.email}, ${license.seats}, ${license.order}, ${new Date().toISOString()}) ON CONFLICT (order_code) DO NOTHING`
  const kept = await licenseOfOrder(license.order)
  if (!kept) throw new Error(`No licence was kept for ${license.order}.`)
  return kept
}

/** The devices a key is on. */
export async function activationsOf(key: string): Promise<string[]> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT device FROM activations WHERE license = ${key} ORDER BY activated_at`
  return rows.map((row) => String(row.device))
}

/** Whether the device is on the key now. */
export async function isActivated(
  key: string,
  device: string
): Promise<boolean> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT 1 AS on_it FROM activations WHERE license = ${key} AND device = ${device}`
  return rows.length === 1
}

/**
 * Puts the key on the device, if it has a seat left — in one statement, so two
 * devices activating at once cannot both take the last seat. A device already
 * on it stays on it. True when the device is on the key afterwards.
 */
export async function activate(
  license: License,
  device: string
): Promise<boolean> {
  const db = await database()
  await db.sql`INSERT INTO activations (license, device, activated_at) SELECT ${license.key}, ${device}, ${new Date().toISOString()} WHERE (SELECT COUNT(*) FROM activations WHERE license = ${license.key}) < ${license.seats} ON CONFLICT (license, device) DO NOTHING`
  return isActivated(license.key, device)
}

/** Takes the key off the device, freeing its seat. */
export async function deactivate(key: string, device: string): Promise<void> {
  const db = await database()
  await db.sql`DELETE FROM activations WHERE license = ${key} AND device = ${device}`
}

function licenseOf(row: Record<string, unknown> | undefined): License | null {
  if (!row) return null
  return {
    key: String(row.key),
    email: text(row.email),
    seats: Number(row.seats),
    revoked: row.revoked_at !== null && row.revoked_at !== undefined,
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}
