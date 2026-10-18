import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

import {
  CREDIT_PACKS,
  isCreditItem,
  MONTHLY_PRICES,
  type Account,
  type CreditItem,
  type PaidPlan,
} from "./billing.ts"

/**
 * SePay's half of `billing.ts`: Vietnamese bank transfers by VietQR.
 *
 * A transfer cannot renew itself, so a plan is bought for 1, 3 or 12 months up
 * front, and buying again adds to whatever is left. Each purchase is an `Order`
 * whose code the transfer's content carries; SePay watches the bank account
 * and sends every incoming transfer to the webhook, which finds the order by
 * that code.
 */

export type Months = 1 | 3 | 12
export type PlanItem = `${PaidPlan}-${Months}m`
export type BankItem = PlanItem | CreditItem

/** Three months are three times the month; twelve are ten — two months free
 * for paying a year ahead. */
const MONTH_FACTOR: Record<Months, number> = { 1: 1, 3: 3, 12: 10 }

const DAY_MS = 24 * 60 * 60 * 1000
/** A month bought is thirty days — the same for everybody, whatever month it
 * is bought in. */
const MONTH_MS = 30 * DAY_MS

/** `starter-3m` as its plan and months, or null for anything else. */
export function planItemOf(
  item: string
): { plan: PaidPlan; months: Months } | null {
  const match = /^(starter|plus|pro)-(1|3|12)m$/.exec(item)
  if (!match) return null
  return { plan: match[1] as PaidPlan, months: Number(match[2]) as Months }
}

export function isBankItem(value: unknown): value is BankItem {
  return (
    typeof value === "string" &&
    (planItemOf(value) !== null || isCreditItem(value))
  )
}

export function priceOf(item: BankItem): number {
  const plan = planItemOf(item)
  if (plan) return MONTHLY_PRICES[plan.plan] * MONTH_FACTOR[plan.months]
  return CREDIT_PACKS[item as CreditItem].price
}

/**
 * The account after a plan bought by transfer.
 *
 * The same plan again extends it from whenever it would have ended. Another
 * plan starts now, and what was left of the old one is carried over **by
 * value**: its remaining days at the old plan's price buy days at the new
 * one's. An upgrade gets fewer days of the dearer plan, a downgrade more of
 * the cheaper, and nobody loses what they paid for.
 */
export function addPrepaid(
  account: Account,
  plan: PaidPlan,
  months: Months,
  now = new Date()
): Account {
  const current = account.prepaid
  const left = current
    ? Math.max(0, new Date(current.until).getTime() - now.getTime())
    : 0
  const carried =
    !current || left === 0
      ? 0
      : current.id === plan
        ? left
        : (left * MONTHLY_PRICES[current.id]) / MONTHLY_PRICES[plan]
  const until = new Date(now.getTime() + carried + months * MONTH_MS)
  return { ...account, prepaid: { id: plan, until: until.toISOString() } }
}

/**
 * A purchase waiting on its transfer. `code` is what the transfer's content
 * must carry — the server's prefix and eight digits. Digits because every
 * banking app keeps them intact, where letters may change case and
 * punctuation may be dropped.
 */
export type Order = {
  code: string
  uid: string
  item: BankItem
  amount: number
  createdAt: string
  /** The SePay transaction that paid it, once one has. */
  paidBy: number | null
  /** Transfers that carried the code but fell short, kept for whoever
   * reconciles them by hand. */
  short: { id: number; amount: number }[]
}

export function newOrderCode(prefix: string): string {
  return `${prefix}${String(randomInt(0, 100_000_000)).padStart(8, "0")}`
}

/** A SePay transaction webhook, as much of it as is read here. */
export type Transfer = {
  id: number
  code: string | null
  content: string
  transferType: string
  transferAmount: number
}

export function transferOf(payload: unknown): Transfer | null {
  const fields = (payload ?? {}) as Record<string, unknown>
  if (typeof fields.id !== "number") return null
  return {
    id: fields.id,
    code: typeof fields.code === "string" && fields.code ? fields.code : null,
    content: typeof fields.content === "string" ? fields.content : "",
    transferType:
      typeof fields.transferType === "string" ? fields.transferType : "",
    transferAmount: Number(fields.transferAmount) || 0,
  }
}

/**
 * The order code a transfer carries. SePay's own `code` when its payment-code
 * structure is configured to find it; otherwise read out of the content here,
 * since a setting missing in SePay's dashboard should not leave money
 * unmatched. Upper-cased: a banking app may send the content in either case.
 */
export function orderCodeOf(transfer: Transfer, prefix: string): string | null {
  const code = transfer.code?.toUpperCase()
  if (code && new RegExp(`^${prefix}\\d{8}$`).test(code)) return code
  const match = new RegExp(`${prefix}\\d{8}`).exec(
    transfer.content.toUpperCase()
  )
  return match?.[0] ?? null
}

/** What a transfer did, for the log line and for a test to check. */
export type Paid =
  | { kind: "ignored"; reason: string }
  | { kind: "short"; order: Order }
  | { kind: "plan"; order: Order; account: Account; until: string }
  | { kind: "credits"; order: Order; account: Account; added: number }

/**
 * A transfer applied to the order its code names and the account behind it.
 *
 * Paid at least in full, the order grants what it sells — even an old one: the
 * money arrived, and refusing it would be keeping somebody's payment. Short,
 * it grants nothing and is noted on the order. An order already paid is not
 * paid twice; a second transfer for it is left for a human to refund.
 */
export function applyTransfer(
  order: Order,
  account: Account,
  transfer: Transfer,
  now = new Date()
): Paid {
  if (transfer.transferType !== "in") {
    return { kind: "ignored", reason: "money going out" }
  }
  if (order.paidBy !== null) {
    return { kind: "ignored", reason: `order already paid by ${order.paidBy}` }
  }
  if (transfer.transferAmount < order.amount) {
    return {
      kind: "short",
      order: {
        ...order,
        short: [
          ...order.short,
          { id: transfer.id, amount: transfer.transferAmount },
        ],
      },
    }
  }

  const paid = { ...order, paidBy: transfer.id }
  const plan = planItemOf(order.item)
  if (plan) {
    const updated = addPrepaid(account, plan.plan, plan.months, now)
    return {
      kind: "plan",
      order: paid,
      account: updated,
      until: updated.prepaid?.until ?? "",
    }
  }
  const added = CREDIT_PACKS[order.item as CreditItem].credits
  return {
    kind: "credits",
    order: paid,
    added,
    account: { ...account, credits: account.credits + added },
  }
}

/**
 * SePay's webhook authentication, whichever the webhook was set up with:
 * `X-SePay-Signature: sha256=<hex>` over `<timestamp>.<raw body>` with
 * `X-SePay-Timestamp`, or `Authorization: Apikey <key>`. With neither
 * configured nothing is accepted.
 */
export function webhookAuthentic(
  body: string,
  headers: Headers,
  keys: { secret: string; apiKey: string },
  now = Date.now()
): boolean {
  const same = (a: string, b: string) => {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
  }

  if (keys.secret) {
    const signature = headers.get("x-sepay-signature")
    const timestamp = headers.get("x-sepay-timestamp")
    if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false
    if (Math.abs(now / 1000 - Number(timestamp)) > 5 * 60) return false
    const expected = `sha256=${createHmac("sha256", keys.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex")}`
    return same(expected, signature)
  }
  if (keys.apiKey) {
    return same(`Apikey ${keys.apiKey}`, headers.get("authorization") ?? "")
  }
  return false
}

/** The QR a banking app scans: SePay's VietQR image for the account, amount
 * and content, all filled in. */
export function qrUrl(input: {
  account: string
  bank: string
  amount: number
  code: string
}): string {
  const params = new URLSearchParams({
    acc: input.account,
    bank: input.bank,
    amount: String(input.amount),
    des: input.code,
  })
  return `https://qr.sepay.vn/img?${params}`
}
