import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"

import {
  CREDIT_PACKS,
  isCreditItem,
  isOnSale,
  NO_ACCOUNT,
  ON_SALE,
  packsAffordable,
  unsoldCredits,
  type Account,
} from "../server/utils/billing.ts"
import {
  applyWebhook,
  catalogOf,
  refsOf,
  signatureValid,
} from "../server/utils/paddle-billing.ts"
import { CREDITS_PER_USD, weighted } from "../server/utils/usage.ts"

/**
 * Paddle's webhooks applied to an account, with payloads in the shape its docs
 * give — and what a request takes from credits. Bank
 * transfers are `sepay.test.ts`.
 */

const catalog = catalogOf({
  "vnd-100k": "pri_c60",
  "vnd-200k": "",
})

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
  test("the credit packs, and nothing else", () => {
    expect(isCreditItem("vnd-50k")).toBe(true)
    expect(isCreditItem("vnd-20k")).toBe(true)
    expect(isCreditItem("plus")).toBe(false)
    expect(isCreditItem("plus-3m")).toBe(false)
    expect(isCreditItem("pri_c60")).toBe(false)
  })
  test("20.000 ₫ for $10.00 is the one pack on sale", () => {
    expect(ON_SALE).toEqual(["vnd-20k"])
    expect(CREDIT_PACKS["vnd-20k"]).toMatchObject({
      price: 20_000,
      credits: 10 * CREDITS_PER_USD,
    })
    expect(isOnSale("vnd-20k")).toBe(true)
  })
  test("a retired pack is still a pack, so old orders are credited", () => {
    expect(isCreditItem("vnd-100k")).toBe(true)
    expect(isOnSale("vnd-100k")).toBe(false)
    expect(isOnSale("plus")).toBe(false)
  })
  test("the pool is what the keys were bought with, less what was sold", () => {
    const pack = CREDIT_PACKS["vnd-20k"].credits
    // Three $10 keys, two packs paid for: one left.
    expect(unsoldCredits(30, 2 * pack)).toBe(pack)
    // A REAL sum a hair under the dollar still counts as the dollar.
    expect(unsoldCredits(0.1 + 0.2, 0)).toBe(3_000_000)
    // Oversold by a race is out, not negative.
    expect(unsoldCredits(10, 2 * pack)).toBe(0)
    expect(unsoldCredits(0, 0)).toBe(0)
  })
  test("the pool sells only whole packs", () => {
    const pack = CREDIT_PACKS["vnd-20k"].credits
    expect(packsAffordable(3 * pack, {}, ON_SALE)).toEqual({ "vnd-20k": 3 })
    // $25 behind is two $10 packs, not three.
    expect(packsAffordable(2.5 * pack, {}, ON_SALE)).toEqual({ "vnd-20k": 2 })
    // Short of one whole pack is out of credits.
    expect(packsAffordable(pack - 1, {}, ON_SALE)).toEqual({ "vnd-20k": 0 })
    expect(packsAffordable(0, {}, ON_SALE)).toEqual({ "vnd-20k": 0 })
  })
  test("unpaid orders hold their packs back", () => {
    const pack = CREDIT_PACKS["vnd-20k"].credits
    expect(packsAffordable(3 * pack, { "vnd-20k": 2 }, ON_SALE)).toEqual({
      "vnd-20k": 1,
    })
    // An old order for a retired pack holds back what it would add.
    expect(
      packsAffordable(
        CREDIT_PACKS["vnd-50k"].credits + pack,
        { "vnd-50k": 1 },
        ON_SALE
      )
    ).toEqual({ "vnd-20k": 1 })
    expect(packsAffordable(pack, { "vnd-20k": 5 }, ON_SALE)).toEqual({
      "vnd-20k": 0,
    })
  })
  test("an unset price is not on sale", () => {
    expect(Object.values(catalog)).not.toContain("vnd-200k")
  })
  // Paddle's fixed $0.50 is most of 20.000 ₫, and its floor is 20.276 ₫.
  test("only the smallest pack is bank transfer only", () => {
    const bankOnly = Object.entries(CREDIT_PACKS)
      .filter(([, pack]) => pack.bankOnly)
      .map(([id, pack]) => [id, pack.price])
    expect(bankOnly).toEqual([["vnd-20k", 20_000]])
  })
})

describe("credit packs", () => {
  test("a completed one-time transaction adds its credits once", () => {
    const once = accountAfter(transaction())
    expect(once.credits).toBe(CREDIT_PACKS["vnd-100k"].credits)
    expect(applyWebhook(once, transaction(), catalog).kind).toBe("ignored")
  })

  test("what was bought and paid goes on the row", () => {
    const applied = applyWebhook(
      NO_ACCOUNT,
      transaction({
        currency_code: "VND",
        details: { totals: { grand_total: "59000" } },
      }),
      catalog
    )
    expect(applied.kind === "credits" && applied.purchase).toEqual({
      item: "vnd-100k",
      amount: 59000,
      currency: "VND",
    })
  })

  test("a payload without totals still credits, with no amount", () => {
    const applied = applyWebhook(NO_ACCOUNT, transaction(), catalog)
    expect(applied.kind === "credits" && applied.purchase).toEqual({
      item: "vnd-100k",
      amount: null,
      currency: null,
    })
  })

  test("a quantity of two is twice the credits", () => {
    const two = accountAfter(
      transaction({ items: [{ price: { id: "pri_c60" }, quantity: 2 }] })
    )
    expect(two.credits).toBe(2 * CREDIT_PACKS["vnd-100k"].credits)
  })

  test("a price this server does not sell — a plan's — adds nothing", () => {
    const plan = transaction({ items: [{ price: { id: "pri_plus" } }] })
    expect(applyWebhook(NO_ACCOUNT, plan, catalog).kind).toBe("ignored")
  })

  test("a subscription event is not one this server reads", () => {
    const event = { event_type: "subscription.updated", data: { id: "sub_1" } }
    expect(applyWebhook(NO_ACCOUNT, event, catalog).kind).toBe("ignored")
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
  test("a transaction names itself and its buyer", () => {
    expect(refsOf(transaction())).toEqual({
      event: "transaction.completed",
      uid: "uid-1",
      transactionId: "txn_1",
    })
  })
  test("a refund names only its transaction", () => {
    expect(refsOf(refund())).toEqual({
      event: "adjustment.updated",
      uid: null,
      transactionId: "txn_1",
    })
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
