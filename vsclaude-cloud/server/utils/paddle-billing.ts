import { createHmac, timingSafeEqual } from "node:crypto"

import { CREDIT_PACKS, type Account, type CreditItem } from "./billing.ts"

/**
 * Paddle's half of `billing.ts`: card payments from anywhere, one credit pack
 * a transaction.
 *
 * What can be bought is named by the app's own ids (`credits-60k`), never by
 * Paddle's price ids: sandbox and live are two Paddle accounts with two sets
 * of them, so they are configuration (`NITRO_PADDLE_PRICE_*`).
 */

/** Paddle's price id → what it sells. An unset price is left out. */
export type Catalog = Record<string, CreditItem>

export function catalogOf(
  prices: Partial<Record<CreditItem, string>>
): Catalog {
  const catalog: Catalog = {}
  for (const [item, price] of Object.entries(prices)) {
    if (price) catalog[price] = item as CreditItem
  }
  return catalog
}

/**
 * `Paddle-Signature: ts=…;h1=…` — an HMAC-SHA256, hex, of `ts:body` under the
 * notification destination's secret. More than one `h1` while a secret is
 * being rotated; any of them will do.
 *
 * Five minutes either way rather than Paddle's SDKs' five seconds: a server
 * clock a few seconds out would refuse every webhook, and a replay inside the
 * window changes nothing — orders are credited once.
 */
export function signatureValid(
  body: string,
  header: string | null,
  secret: string,
  now = Date.now()
): boolean {
  if (!header || !secret) return false
  const parts = header.split(";").map((part) => part.split("="))
  const ts = parts.find(([key]) => key === "ts")?.[1]
  const signatures = parts
    .filter(([key]) => key === "h1")
    .map(([, value]) => value ?? "")
  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) return false
  if (Math.abs(now / 1000 - Number(ts)) > 5 * 60) return false
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")
  )
  return signatures.some((signature) => {
    const given = Buffer.from(signature)
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
}

type Payload = {
  event_type?: unknown
  data?: Record<string, unknown>
}

/** What a webhook is about, to find its user by: the uid the checkout carried
 * when it has one, and the transaction it belongs to. */
export function refsOf(payload: unknown): {
  event: string
  uid: string | null
  transactionId: string | null
} {
  const { event_type, data = {} } = (payload ?? {}) as Payload
  const event = typeof event_type === "string" ? event_type : ""
  const custom = data.custom_data as { uid?: unknown } | null | undefined
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null
  return {
    event,
    uid: text(custom?.uid),
    transactionId: event.startsWith("transaction.")
      ? text(data.id)
      : text(data.transaction_id),
  }
}

/** What a webhook did, for the log line and for a test to check. */
export type Applied =
  | { kind: "ignored"; reason: string }
  | {
      kind: "credits"
      transactionId: string
      account: Account
      added: number
      purchase: Purchase
    }
  | {
      kind: "refund"
      transactionId: string
      account: Account
      removed: number
    }

/**
 * What was bought and paid, for the transaction's row: the pack — several
 * joined by commas, which this server's own checkouts never make — and the
 * total charged, in the currency's smallest unit as Paddle states it (a đồng
 * for VND, a cent for USD), since Paddle may charge in the buyer's currency.
 */
export type Purchase = {
  item: string | null
  amount: number | null
  currency: string | null
}

function purchaseOf(
  data: Record<string, unknown>,
  items: { id: CreditItem }[]
): Purchase {
  const details = data.details as
    { totals?: { grand_total?: unknown } } | null | undefined
  const total = Number(details?.totals?.grand_total)
  const currency = data.currency_code
  return {
    item: [...new Set(items.map((item) => item.id))].join(",") || null,
    amount: Number.isFinite(total) ? total : null,
    currency: typeof currency === "string" && currency ? currency : null,
  }
}

type Item = { price?: { id?: unknown }; quantity?: unknown }

function itemsOf(data: Record<string, unknown>, catalog: Catalog) {
  const items = Array.isArray(data.items) ? (data.items as Item[]) : []
  return items.flatMap((item) => {
    const id = catalog[String(item.price?.id)]
    const quantity = Number(item.quantity ?? 1)
    return id ? [{ id, quantity: quantity > 0 ? quantity : 1 }] : []
  })
}

/**
 * A webhook applied to the account it is about.
 *
 * `transaction.completed` credits a purchase's packs once. Anything in it this
 * server does not sell — a plan from when there were plans — adds nothing.
 *
 * An approved full refund (`adjustment.*`) takes a pack's credits back, as far
 * as they have not been spent. A partial one leaves the pack: what part of it
 * was returned is the seller's call, made in Paddle and not guessed at here.
 */
export function applyWebhook(
  account: Account,
  payload: unknown,
  catalog: Catalog
): Applied {
  const { event_type, data = {} } = (payload ?? {}) as Payload
  const event = typeof event_type === "string" ? event_type : ""
  const id = typeof data.id === "string" ? data.id : ""

  if (event === "transaction.completed") {
    const items = itemsOf(data, catalog)
    const added = items.reduce(
      (sum, item) => sum + CREDIT_PACKS[item.id].credits * item.quantity,
      0
    )
    if (added === 0) return { kind: "ignored", reason: "no credit pack" }
    if (account.orders.some((order) => order.id === id)) {
      return { kind: "ignored", reason: "already credited" }
    }
    return {
      kind: "credits",
      transactionId: id,
      added,
      purchase: purchaseOf(data, items),
      account: {
        ...account,
        credits: account.credits + added,
        orders: [...account.orders, { id, credits: added }],
      },
    }
  }

  if (event === "adjustment.created" || event === "adjustment.updated") {
    if (
      data.action !== "refund" ||
      data.status !== "approved" ||
      data.type !== "full"
    ) {
      return { kind: "ignored", reason: "not an approved full refund" }
    }
    const order = account.orders.find(
      (entry) => entry.id === data.transaction_id
    )
    if (!order) return { kind: "ignored", reason: "not a credited pack" }
    const removed = Math.min(account.credits, order.credits)
    return {
      kind: "refund",
      transactionId: order.id,
      removed,
      account: {
        ...account,
        credits: account.credits - removed,
        orders: account.orders.filter((entry) => entry !== order),
      },
    }
  }

  return { kind: "ignored", reason: `event ${event || "unnamed"}` }
}
