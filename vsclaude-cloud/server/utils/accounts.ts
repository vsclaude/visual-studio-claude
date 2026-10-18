import { useStorage } from "nitro/storage"

import { NO_ACCOUNT, type Account } from "./billing.ts"
import type { Order } from "./sepay-billing.ts"

/**
 * What people have paid for, under the `accounts` storage mount
 * (`nitro.config.ts`):
 *
 * - `user:<uid>` — each user's `Account`.
 * - `sub:<id>`, `txn:<id>` — Paddle's subscriptions and transactions back to
 *   the uid. A refund names only its transaction, and a subscription's events
 *   may arrive without the checkout's custom data, so the transaction that
 *   carried the uid is what links them to somebody.
 * - `order:<code>` — each bank-transfer purchase.
 * - `sepay:<id>` — each SePay transaction already applied. SePay retries a
 *   webhook up to seven times and a replay keeps the id, so this is what makes
 *   a transfer count once.
 *
 * Unlike `quota`, this is money somebody paid: the mount must outlive a
 * redeploy, and more than one instance needs a shared driver for it. Writes are
 * read-modify-write without a lock, the same bargain `quota.ts` makes — a
 * payment landing in the same instant as a request's credit charge can lose
 * one of the two, which is a request's worth of credits, not a plan.
 */

const storage = () => useStorage("accounts")

export async function getAccount(uid: string): Promise<Account> {
  const value = await storage().getItem<Account>(`user:${uid}`)
  return value && typeof value === "object"
    ? { ...NO_ACCOUNT, ...value }
    : NO_ACCOUNT
}

export async function saveAccount(
  uid: string,
  account: Account
): Promise<void> {
  await storage().setItem(`user:${uid}`, account)
}

/** Takes `amount` off the user's credits, never below zero. */
export async function chargeCredits(
  uid: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return
  const account = await getAccount(uid)
  await saveAccount(uid, {
    ...account,
    credits: Math.max(0, account.credits - amount),
  })
}

export async function linkToUser(
  kind: "sub" | "txn",
  id: string,
  uid: string
): Promise<void> {
  await storage().setItem(`${kind}:${id}`, uid)
}

export async function userOf(
  kind: "sub" | "txn",
  id: string
): Promise<string | null> {
  const uid = await storage().getItem<string>(`${kind}:${id}`)
  return typeof uid === "string" && uid ? uid : null
}

export async function getOrder(code: string): Promise<Order | null> {
  const value = await storage().getItem<Order>(`order:${code}`)
  return value && typeof value === "object" ? value : null
}

export async function saveOrder(order: Order): Promise<void> {
  await storage().setItem(`order:${order.code}`, order)
}

/** Marks a SePay transaction applied; false when it already was. */
export async function claimTransfer(id: number): Promise<boolean> {
  const key = `sepay:${id}`
  if (await storage().hasItem(key)) return false
  await storage().setItem(key, new Date().toISOString())
  return true
}
