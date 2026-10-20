import { NO_ACCOUNT, type Account } from "./billing.ts"
import { database } from "./database.ts"
import type { Order } from "./sepay-billing.ts"

/**
 * What people have paid for, in the D1 database (`database.ts`):
 *
 * - `accounts` — each user's `Account`: `credits` and `used` as columns, the
 *   Paddle transactions already credited as the `orders` JSON.
 * - `transactions` — Paddle's transactions back to the uid. A refund names only
 *   its transaction, so the transaction that carried the uid is what links it
 *   to somebody. (`sub:<id>` rows are left from when plans were sold.)
 * - `transfer_orders` — each bank-transfer purchase, as its `Order` JSON.
 * - `sepay_transfers` — each SePay transaction already applied. SePay retries a
 *   webhook up to seven times and a replay keeps the id, so the primary key is
 *   what makes a transfer count once.
 * - `sign_in_answers` — a Google sign-in's answer waiting for the studio to
 *   collect it, for minutes at most (`server/utils/signin.ts`).
 *
 * This is money somebody paid. A balance changes in one statement, so two
 * requests charging the same account cannot read the same balance and each
 * take it; a payment and a charge are the same kind of statement.
 */

export async function getAccount(uid: string): Promise<Account> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT credits, used, orders FROM accounts WHERE uid = ${uid}`
  const row = rows[0]
  if (!row) return NO_ACCOUNT
  return {
    credits: Number(row.credits),
    used: Number(row.used),
    orders: JSON.parse(String(row.orders)),
  }
}

export async function saveAccount(
  uid: string,
  account: Account
): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO accounts (uid, credits, used, orders) VALUES (${uid}, ${account.credits}, ${account.used}, ${JSON.stringify(account.orders)}) ON CONFLICT (uid) DO UPDATE SET credits = excluded.credits, used = excluded.used, orders = excluded.orders`
}

/** Takes `amount` off the user's credits, never below zero, and counts what
 * was actually taken as used. */
export async function chargeCredits(
  uid: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return
  const db = await database()
  await db.sql`UPDATE accounts SET used = used + MIN(credits, ${amount}), credits = credits - MIN(credits, ${amount}) WHERE uid = ${uid}`
}

export async function linkToUser(id: string, uid: string): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO transactions (id, uid) VALUES (${id}, ${uid}) ON CONFLICT (id) DO UPDATE SET uid = excluded.uid`
}

export async function userOf(id: string): Promise<string | null> {
  const db = await database()
  const { rows = [] } = await db.sql`SELECT uid FROM transactions WHERE id = ${id}`
  const uid = rows[0]?.uid
  return typeof uid === "string" && uid ? uid : null
}

export async function getOrder(code: string): Promise<Order | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT data FROM transfer_orders WHERE code = ${code}`
  const value = rows[0] ? JSON.parse(String(rows[0].data)) : null
  return value && typeof value === "object" ? value : null
}

export async function saveOrder(order: Order): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO transfer_orders (code, data) VALUES (${order.code}, ${JSON.stringify(order)}) ON CONFLICT (code) DO UPDATE SET data = excluded.data`
}

/** Marks a SePay transaction applied; false when it already was. */
export async function claimTransfer(id: number): Promise<boolean> {
  const db = await database()
  const { rows = [] } = await db.sql`INSERT INTO sepay_transfers (id, applied_at) VALUES (${id}, ${new Date().toISOString()}) ON CONFLICT (id) DO NOTHING RETURNING id`
  return rows.length === 1
}
