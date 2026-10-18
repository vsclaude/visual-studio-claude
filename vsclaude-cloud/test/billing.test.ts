import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"

import {
  creditCharge,
  NO_ACCOUNT,
  planOf,
  type Account,
} from "../server/utils/billing.ts"
import {
  applyWebhook,
  catalogOf,
  isPaddleItem,
  refsOf,
  signatureValid,
} from "../server/utils/paddle-billing.ts"
import { weighted } from "../server/utils/usage.ts"

/**
 * Paddle's webhooks applied to an account, with payloads in the shape its docs
 * give — and what a request past the day's budget takes from credits. Bank
 * transfers are `sepay.test.ts`.
 */

const catalog = catalogOf({
  starter: "pri_starter",
  plus: "pri_plus",
  pro: "pri_pro",
  "credits-60k": "pri_c60",
  "credits-100k": "",
})

function subscription(
  data: Record<string, unknown> = {},
  event = "subscription.updated"
) {
  return {
    event_id: "evt_1",
    event_type: event,
    occurred_at: "2026-10-18T12:00:00Z",
    data: {
      id: "sub_1",
      status: "active",
      customer_id: "ctm_1",
      items: [{ price: { id: "pri_plus" }, quantity: 1 }],
      scheduled_change: null,
      custom_data: { uid: "uid-1" },
      updated_at: "2026-10-18T12:00:00Z",
      ...data,
    },
  }
}

function transaction(data: Record<string, unknown> = {}) {
  return {
    event_type: "transaction.completed",
    data: {
      id: "txn_1",
      status: "completed",
      subscription_id: null,
      items: [{ price: { id: "pri_c60" }, quantity: 1 }],
      custom_data: { uid: "uid-1" },
      ...data,
    },
  }
}

function refund(data: Record<string, unknown> = {}) {
  return {
    event_type: "adjustment.updated",
    data: {
      id: "adj_1",
      action: "refund",
      type: "full",
      status: "approved",
      transaction_id: "txn_1",
      ...data,
    },
  }
}

function accountAfter(payload: unknown, account: Account = NO_ACCOUNT) {
  const applied = applyWebhook(account, payload, catalog)
  if (applied.kind === "ignored") throw new Error(applied.reason)
  return applied.account
}

describe("signatureValid", () => {
  const body = '{"event_type":"transaction.completed"}'
  const now = 1_760_000_000_000
  const ts = String(now / 1000)
  const sign = (secret: string, at = ts) =>
    createHmac("sha256", secret).update(`${at}:${body}`).digest("hex")

  test("the secret's HMAC of ts:body", () => {
    expect(signatureValid(body, `ts=${ts};h1=${sign("pdl")}`, "pdl", now)).toBe(
      true
    )
  })
  test("any h1 while a secret rotates", () => {
    const header = `ts=${ts};h1=${sign("old")};h1=${sign("pdl")}`
    expect(signatureValid(body, header, "pdl", now)).toBe(true)
  })
  test("another secret's", () => {
    expect(
      signatureValid(body, `ts=${ts};h1=${sign("other")}`, "pdl", now)
    ).toBe(false)
  })
  test("too old a timestamp, even signed", () => {
    const old = String(now / 1000 - 600)
    expect(
      signatureValid(body, `ts=${old};h1=${sign("pdl", old)}`, "pdl", now)
    ).toBe(false)
  })
  test("none, malformed, or no secret configured", () => {
    expect(signatureValid(body, null, "pdl", now)).toBe(false)
    expect(signatureValid(body, `h1=${sign("pdl")}`, "pdl", now)).toBe(false)
    expect(signatureValid(body, `ts=${ts};h1=${sign("")}`, "", now)).toBe(false)
  })
})

describe("items", () => {
  test("the app's ids, and nothing else", () => {
    expect(isPaddleItem("plus")).toBe(true)
    expect(isPaddleItem("credits-20k")).toBe(true)
    expect(isPaddleItem("hobby")).toBe(false)
    expect(isPaddleItem("pri_plus")).toBe(false)
    // A month at a time is a subscription; months up front are transfers'.
    expect(isPaddleItem("plus-3m")).toBe(false)
  })
  test("an unset price is not on sale", () => {
    expect(Object.values(catalog)).not.toContain("credits-100k")
  })
})

describe("subscriptions", () => {
  test("an active Plus subscription is Plus", () => {
    const account = accountAfter(subscription())
    expect(planOf(account)).toBe("plus")
    expect(account.subscription?.customerId).toBe("ctm_1")
  })

  test("past due still grants; canceled and paused do not", () => {
    expect(planOf(accountAfter(subscription({ status: "past_due" })))).toBe(
      "plus"
    )
    expect(planOf(accountAfter(subscription({ status: "canceled" })))).toBe(
      "hobby"
    )
    expect(planOf(accountAfter(subscription({ status: "paused" })))).toBe(
      "hobby"
    )
  })

  test("a scheduled cancellation keeps the plan and says when it ends", () => {
    const account = accountAfter(
      subscription({
        scheduled_change: {
          action: "cancel",
          effective_at: "2026-11-18T00:00:00Z",
        },
      })
    )
    expect(planOf(account)).toBe("plus")
    expect(account.subscription?.cancelsAt).toBe("2026-11-18T00:00:00Z")
  })

  test("an older event arriving late is ignored", () => {
    const canceled = accountAfter(
      subscription({ status: "canceled", updated_at: "2026-10-19T00:00:00Z" })
    )
    expect(applyWebhook(canceled, subscription(), catalog).kind).toBe("ignored")
  })

  test("an old subscription ending leaves the new one's plan", () => {
    const pro = accountAfter(
      subscription({ id: "sub_2", items: [{ price: { id: "pri_pro" } }] })
    )
    const applied = applyWebhook(
      pro,
      subscription({ id: "sub_1", status: "canceled" }),
      catalog
    )
    expect(applied.kind).toBe("ignored")
    expect(planOf(pro)).toBe("pro")
  })

  test("a price this server does not sell is ignored", () => {
    const other = subscription({ items: [{ price: { id: "pri_else" } }] })
    expect(applyWebhook(NO_ACCOUNT, other, catalog).kind).toBe("ignored")
  })
})

describe("credit packs", () => {
  test("a completed one-time transaction adds its credits once", () => {
    const once = accountAfter(transaction())
    expect(once.credits).toBe(3_300_000)
    expect(applyWebhook(once, transaction(), catalog).kind).toBe("ignored")
  })

  test("a quantity of two is twice the credits", () => {
    const two = accountAfter(
      transaction({ items: [{ price: { id: "pri_c60" }, quantity: 2 }] })
    )
    expect(two.credits).toBe(6_600_000)
  })

  test("a subscription's transaction is the subscription's business", () => {
    expect(
      applyWebhook(
        NO_ACCOUNT,
        transaction({ subscription_id: "sub_1" }),
        catalog
      ).kind
    ).toBe("ignored")
  })

  test("an approved full refund takes back what is left of the pack", () => {
    const bought = accountAfter(transaction())
    const refunded = accountAfter(refund(), { ...bought, credits: 1_000_000 })
    expect(refunded.credits).toBe(0)
    expect(refunded.orders).toEqual([])
  })

  test("a pending or partial refund leaves the pack", () => {
    const bought = accountAfter(transaction())
    expect(
      applyWebhook(bought, refund({ status: "pending_approval" }), catalog).kind
    ).toBe("ignored")
    expect(
      applyWebhook(bought, refund({ type: "partial" }), catalog).kind
    ).toBe("ignored")
  })
})

describe("refsOf", () => {
  test("a subscription event names its subscription", () => {
    expect(refsOf(subscription())).toMatchObject({
      uid: "uid-1",
      subscriptionId: "sub_1",
    })
  })
  test("a transaction names itself and its subscription", () => {
    expect(refsOf(transaction({ subscription_id: "sub_1" }))).toMatchObject({
      transactionId: "txn_1",
      subscriptionId: "sub_1",
    })
  })
  test("a refund names only its transaction", () => {
    expect(refsOf(refund())).toEqual({
      event: "adjustment.updated",
      uid: null,
      subscriptionId: null,
      transactionId: "txn_1",
    })
  })
})

describe("creditCharge", () => {
  test("within the budget, nothing", () => {
    expect(creditCharge(100, 900, 1000)).toBe(0)
  })
  test("crossing it, the part past it", () => {
    expect(creditCharge(900, 1200, 1000)).toBe(200)
  })
  test("already past it, all of it", () => {
    expect(creditCharge(1200, 1500, 1000)).toBe(300)
  })
  test("no budget, nothing", () => {
    expect(creditCharge(0, 5000, 0)).toBe(0)
  })
})

describe("weighted by model", () => {
  const usage = {
    input_tokens: 100,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 1000,
    output_tokens: 10,
  }
  test("Sonnet at 20× Haiku, with its cheaper cache reads", () => {
    expect(weighted(usage, "claude-sonnet-5-5")).toBe((100 + 50 + 50) * 20)
  })
  test("Opus at 40×", () => {
    expect(weighted(usage, "claude-opus-5-5")).toBe((100 + 50 + 50) * 40)
  })
  test("an unknown model at the dearest price", () => {
    expect(weighted(usage, "claude-next")).toBe(
      weighted(usage, "claude-opus-5-5")
    )
  })
  test("no long-prompt surcharge past Haiku", () => {
    const long = { ...usage, input_tokens: 150_000 }
    expect(weighted(long, "claude-sonnet-5-5")).toBe((150_000 + 50 + 50) * 20)
  })
})
