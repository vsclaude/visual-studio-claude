import { useStorage } from "nitro/storage"

import { NO_ACCOUNT, type Account } from "./billing.ts"
import type { Order } from "./sepay-billing.ts"

/**
 * What people have paid for, under the `accounts` storage mount
 * (`nitro.config.ts`):
 *
 * - `user:<uid>` — each user's `Account`.
 * - `txn:<id>` — Paddle's transactions back to the uid. A refund names only
 *   its transaction, so the transaction that carried the uid is what links it
 *   to somebody. (`sub:<id>` keys are left from when plans were sold.)
 * - `order:<code>` — each bank-transfer purchase.
 * - `sepay:<id>` — each SePay transaction already applied. SePay retries a
 *   webhook up to seven times and a replay keeps the id, so this is what makes
 *   a transfer count once.
 * - `signin:<nonce>` — a Google sign-in's answer waiting for the studio to
 *   collect it, for minutes at most (`server/utils/signin.ts`).
 *
 * This is money somebody paid: the mount must outlive a
 * redeploy, and more than one instance needs a shared driver for it. Writes are
 * read-modify-write without a lock — a
 * payment landing in the same instant as a request's credit charge can lose
 * one of the two, which is a request's worth of credits.
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

/** Takes `amount` off the user's credits, never below zero, and counts what
 * was actually taken as used. */
export async function chargeCredits(
  uid: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return
  const account = await getAccount(uid)
  const taken = Math.min(amount, account.credits)
  await saveAccount(uid, {
    ...account,
    credits: account.credits - taken,
    used: account.used + taken,
  })
}

export async function linkToUser(id: string, uid: string): Promise<void> {
  await storage().setItem(`txn:${id}`, uid)
}

export async function userOf(id: string): Promise<string | null> {
  const uid = await storage().getItem<string>(`txn:${id}`)
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
