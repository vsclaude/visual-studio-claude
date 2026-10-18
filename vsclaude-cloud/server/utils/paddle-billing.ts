import { createHmac, timingSafeEqual } from "node:crypto"

import {
  CREDIT_PACKS,
  grants,
  isCreditItem,
  planOf,
  type Account,
  type CreditItem,
  type PaidPlan,
  type PlanId,
  type Subscription,
} from "./billing.ts"

/**
 * Paddle's half of `billing.ts`: card payments from anywhere, a plan as a
 * monthly subscription Paddle renews.
 *
 * What can be bought is named by the app's own ids (`starter`, `credits-60k`),
 * never by Paddle's price ids: sandbox and live are two Paddle accounts with
 * two sets of them, so they are configuration (`NITRO_PADDLE_PRICE_*`).
 */

export type PaddleItem = PaidPlan | CreditItem

export function isPaddleItem(value: unknown): value is PaddleItem {
  return (
    value === "starter" ||
    value === "plus" ||
    value === "pro" ||
    isCreditItem(value)
  )
}

/** Paddle's price id → what it sells. An unset price is left out. */
export type Catalog = Record<string, PaddleItem>

export function catalogOf(
  prices: Partial<Record<PaddleItem, string>>
): Catalog {
  const catalog: Catalog = {}
  for (const [item, price] of Object.entries(prices)) {
    if (price) catalog[price] = item as PaddleItem
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
 * window changes nothing — orders are credited once, and a subscription older
 * than the one on file is ignored.
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
  occurred_at?: unknown
  data?: Record<string, unknown>
}

/** What a webhook is about, to find its user by: the uid the checkout carried
 * when it has one, and the subscription or transaction it belongs to. */
export function refsOf(payload: unknown): {
  event: string
  uid: string | null
  subscriptionId: string | null
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
    subscriptionId: event.startsWith("subscription.")
      ? text(data.id)
      : text(data.subscription_id),
    transactionId: event.startsWith("transaction.")
      ? text(data.id)
      : text(data.transaction_id),
  }
}

/** What a webhook did, for the log line and for a test to check. */
export type Applied =
  | { kind: "ignored"; reason: string }
  | { kind: "subscription"; account: Account; plan: PlanId }
  | { kind: "credits"; account: Account; added: number }
  | { kind: "refund"; account: Account; removed: number }

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
 * Every `subscription.*` event carries the whole subscription, so each is read
 * the same way: the record becomes what the payload says, unless it is older
 * than the one on file. One subscription is kept per account; a second one's
 * events replace it only while the first no longer grants anything — an old
 * subscription ending must not take away the plan of the new one.
 *
 * `transaction.completed` credits a one-time purchase's packs once.
 * A subscription's transactions are the subscription events' business.
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
  const { event_type, occurred_at, data = {} } = (payload ?? {}) as Payload
  const event = typeof event_type === "string" ? event_type : ""
  const id = typeof data.id === "string" ? data.id : ""

  if (event.startsWith("subscription.")) {
    const plan = itemsOf(data, catalog)
      .map((item) => item.id)
      .find((item): item is PaidPlan => !isCreditItem(item))
    if (!plan) return { kind: "ignored", reason: "no plan in its items" }

    const scheduled = data.scheduled_change as
      { action?: unknown; effective_at?: unknown } | null | undefined
    const updatedAt = String(data.updated_at ?? occurred_at ?? "")
    const next: Subscription = {
      id,
      plan,
      status: typeof data.status === "string" ? data.status : "",
      customerId:
        typeof data.customer_id === "string" ? data.customer_id : null,
      cancelsAt:
        scheduled?.action === "cancel" &&
        typeof scheduled.effective_at === "string"
          ? scheduled.effective_at
          : null,
      updatedAt,
    }

    const current = account.subscription
    if (current?.id === id && current.updatedAt > updatedAt) {
      return { kind: "ignored", reason: "older than the one on file" }
    }
    if (current && current.id !== id && grants(current)) {
      return { kind: "ignored", reason: "another subscription is live" }
    }
    const updated = { ...account, subscription: next }
    return { kind: "subscription", account: updated, plan: planOf(updated) }
  }

  if (event === "transaction.completed") {
    if (data.subscription_id) {
      return { kind: "ignored", reason: "a subscription's transaction" }
    }
    const added = itemsOf(data, catalog).reduce(
      (sum, item) =>
        sum +
        (isCreditItem(item.id) ? CREDIT_PACKS[item.id].credits : 0) *
          item.quantity,
      0
    )
    if (added === 0) return { kind: "ignored", reason: "no credit pack" }
    if (account.orders.some((order) => order.id === id)) {
      return { kind: "ignored", reason: "already credited" }
    }
    return {
      kind: "credits",
      added,
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
