import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"

import {
  CREDIT_PACKS,
  isCreditItem,
  isOnSale,
  NO_ACCOUNT,
  ON_SALE,
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
  test("all four packs are on sale, cheapest first", () => {
    expect(ON_SALE).toEqual(["vnd-20k", "vnd-50k", "vnd-100k", "vnd-200k"])
    // 30.000 ₫ to the dollar, and 10% and 20% more on the two biggest.
    expect(CREDIT_PACKS["vnd-20k"]).toMatchObject({
      price: 20_000,
      credits: 6_666_667,
    })
    expect(CREDIT_PACKS["vnd-50k"].credits).toBe(16_666_667)
    expect(CREDIT_PACKS["vnd-100k"].credits).toBe(36_666_667)
    expect(CREDIT_PACKS["vnd-200k"].credits).toBe(8 * CREDITS_PER_USD)
    expect(isOnSale("vnd-200k")).toBe(true)
    expect(isOnSale("plus")).toBe(false)
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
  // A credit is $0.0000001, so a token at $X/MTok is 10·X credits.
  test("Flash at $0.30 in, $0.006 cached, $1.20 out", () => {
    expect(weighted(usage, "deepseek-flash")).toBe(300 + 60 + 120)
  })
  test("V4 Pro at $1.32 in, $0.044 cached, $3.96 out", () => {
    expect(weighted(usage, "deepseek-v4-pro")).toBe(1320 + 440 + 396)
  })
  test("a Claude name is charged as what DeepSeek answers it on", () => {
    expect(weighted(usage, "claude-opus-5-5")).toBe(
      weighted(usage, "deepseek-v4-pro")
    )
    expect(weighted(usage, "claude-sonnet-5-5")).toBe(
      weighted(usage, "deepseek-flash")
    )
    expect(weighted(usage, "claude-haiku-5-5")).toBe(
      weighted(usage, "deepseek-flash")
    )
  })
  test("an unknown model at the dearest price", () => {
    expect(weighted(usage, "deepseek-next")).toBe(
      weighted(usage, "deepseek-v4-pro")
    )
  })
  test("no long-prompt rate", () => {
    const long = { ...usage, input_tokens: 150_000 }
    expect(weighted(long, "deepseek-flash")).toBe(450_000 + 60 + 120)
  })
})
