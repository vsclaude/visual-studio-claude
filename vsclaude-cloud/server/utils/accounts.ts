import { NO_ACCOUNT, type Account } from "./billing.ts"
import { atomically, database, statement } from "./database.ts"
import type { Purchase } from "./paddle-billing.ts"
import type { Order } from "./sepay-billing.ts"
import type { User } from "./session.ts"

/**
 * What people have paid for, in the D1 database (`database.ts`):
 *
 * - `users` — everybody who has signed in (`/signin/callback`): who Google
 *   says they are, as of their last sign-in, and their credits left and ever
 *   used. The uid is `google:<sub>`. Ending somebody's sessions is deleting
 *   their row (`POST /api/session`).
 * - `transactions` — one row per purchase, `provider` saying whose:
 *   - `paddle`, keyed by Paddle's transaction id. The webhook that carries the
 *     uid writes it `pending` before anything is credited, because a refund
 *     names only its transaction and this row is how it finds somebody.
 *     Credited, it is `paid` with the `credits` it added and the `item`,
 *     `amount` and `currency` Paddle charged; refunded in full,
 *     `refunded` — kept rather than deleted, so a late replay of the purchase
 *     cannot credit it again.
 *   - `sepay`, keyed by the order code a bank transfer carries. It is written
 *     `pending` with the `item` and `amount` (`VND`) asked when the order is opened,
 *     and is `paid` by the SePay transfer in `paid_by`. Transfers that fell
 *     short add up in `short_amount`; `short_by` is the last one, so SePay
 *     retrying the same webhook adds it once.
 *
 * This is money somebody paid. A balance only ever changes by a statement
 * relative to what it is — never by writing back a total read earlier — and a
 * purchase moves out of `pending` in the same D1 batch that adds its credits,
 * so neither a charge racing a payment nor a webhook delivered twice miscounts.
 */

/** Writes down who just signed in, keeping their balance. */
export async function saveUser(user: User): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO users (uid, email, name, picture, signed_in_at) VALUES (${user.uid}, ${user.email}, ${user.name}, ${user.picture}, ${new Date().toISOString()}) ON CONFLICT (uid) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, signed_in_at = excluded.signed_in_at`
}

export async function getUser(uid: string): Promise<User | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT uid, email, name, picture FROM users WHERE uid = ${uid}`
  const row = rows[0]
  if (!row) return null
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null
  return {
    uid: String(row.uid),
    email: text(row.email),
    name: text(row.name),
    picture: text(row.picture),
  }
}

export async function getAccount(uid: string): Promise<Account> {
  const db = await database()
  const { rows: users = [] } =
    await db.sql`SELECT credits, used FROM users WHERE uid = ${uid}`
  const { rows: paid = [] } =
    await db.sql`SELECT id, credits FROM transactions WHERE provider = 'paddle' AND uid = ${uid} AND status = 'paid'`
  const user = users[0]
  if (!user) return NO_ACCOUNT
  return {
    credits: Number(user.credits),
    used: Number(user.used),
    orders: paid.map((row) => ({
      id: String(row.id),
      credits: Number(row.credits),
    })),
  }
}

/** Takes `amount` off the user's credits, never below zero, and counts what
 * was actually taken as used. */
export async function chargeCredits(
  uid: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return
  const db = await database()
  await db.sql`UPDATE users SET used = used + MIN(credits, ${amount}), credits = credits - MIN(credits, ${amount}) WHERE uid = ${uid}`
}

/** Records whose a Paddle transaction is, for the events after it. */
export async function linkToUser(id: string, uid: string): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO transactions (provider, id, uid, status, created_at) VALUES ('paddle', ${id}, ${uid}, 'pending', ${new Date().toISOString()}) ON CONFLICT (provider, id) DO UPDATE SET uid = excluded.uid`
}

export async function userOf(id: string): Promise<string | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT uid FROM transactions WHERE provider = 'paddle' AND id = ${id}`
  const uid = rows[0]?.uid
  return typeof uid === "string" && uid ? uid : null
}

/** Adds a Paddle purchase's credits, once: a transaction already credited or
 * refunded adds nothing, however many times its webhook arrives. */
export async function creditPaddleTransaction(
  uid: string,
  id: string,
  credits: number,
  { item, amount, currency }: Purchase
): Promise<void> {
  await atomically(
    statement`INSERT INTO users (uid, credits) SELECT ${uid}, ${credits} WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE provider = 'paddle' AND id = ${id} AND status != 'pending') ON CONFLICT (uid) DO UPDATE SET credits = credits + excluded.credits`,
    statement`INSERT INTO transactions (provider, id, uid, status, item, amount, currency, credits, created_at) VALUES ('paddle', ${id}, ${uid}, 'paid', ${item}, ${amount}, ${currency}, ${credits}, ${new Date().toISOString()}) ON CONFLICT (provider, id) DO UPDATE SET status = 'paid', item = excluded.item, amount = excluded.amount, currency = excluded.currency, credits = excluded.credits WHERE transactions.status = 'pending'`
  )
}

/** Whether a Paddle purchase is credited yet, and how much it added — what the
 * `/checkout` page waits on. Null until the webhook has carried its uid. */
export async function paddlePurchase(
  id: string
): Promise<{ paid: boolean; credits: number } | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT status, credits FROM transactions WHERE provider = 'paddle' AND id = ${id}`
  const row = rows[0]
  if (!row) return null
  return { paid: row.status === "paid", credits: Number(row.credits) || 0 }
}

/** Takes a refunded Paddle purchase's credits back, as far as they have not
 * been spent. */
export async function refundPaddleTransaction(
  uid: string,
  id: string
): Promise<void> {
  await atomically(
    statement`UPDATE users SET credits = credits - MIN(credits, (SELECT credits FROM transactions WHERE provider = 'paddle' AND id = ${id} AND uid = ${uid} AND status = 'paid')) WHERE uid = ${uid} AND EXISTS (SELECT 1 FROM transactions WHERE provider = 'paddle' AND id = ${id} AND uid = ${uid} AND status = 'paid')`,
    statement`UPDATE transactions SET status = 'refunded' WHERE provider = 'paddle' AND id = ${id} AND uid = ${uid} AND status = 'paid'`
  )
}

export async function getOrder(code: string): Promise<Order | null> {
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT uid, item, amount, paid_by, short_amount, created_at FROM transactions WHERE provider = 'sepay' AND id = ${code}`
  const row = rows[0]
  if (!row) return null
  return {
    code,
    uid: String(row.uid),
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
    await db.sql`INSERT INTO transactions (provider, id, uid, status, item, amount, currency, created_at) VALUES ('sepay', ${order.code}, ${order.uid}, 'pending', ${order.item}, ${order.amount}, 'VND', ${order.createdAt}) ON CONFLICT (provider, id) DO NOTHING RETURNING id`
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

/** Adds the order's credits to the buyer and marks it paid by the transfer —
 * once: an order already paid adds nothing. */
export async function payOrder(
  order: Order,
  transferId: number,
  credits: number
): Promise<void> {
  await atomically(
    statement`INSERT INTO users (uid, credits) SELECT ${order.uid}, ${credits} WHERE EXISTS (SELECT 1 FROM transactions WHERE provider = 'sepay' AND id = ${order.code} AND status = 'pending') ON CONFLICT (uid) DO UPDATE SET credits = credits + excluded.credits`,
    statement`UPDATE transactions SET status = 'paid', paid_by = ${transferId}, credits = ${credits} WHERE provider = 'sepay' AND id = ${order.code} AND status = 'pending'`
  )
}
