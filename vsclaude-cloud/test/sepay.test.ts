import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"

import { CREDIT_PACKS, NO_ACCOUNT } from "../server/utils/billing.ts"
import {
  applyTransfer,
  newOrderCode,
  orderCodeOf,
  qrUrl,
  transferOf,
  webhookAuthentic,
  type Order,
  type Transfer,
} from "../server/utils/sepay-billing.ts"

/**
 * Bank transfers through SePay: which transfer pays an order, and what it adds
 * — with webhook payloads in the shape SePay's docs give.
 */

const NOW = new Date("2026-10-18T00:00:00Z")

function order(
  item: Order["item"] = "credits-60k",
  fields: Partial<Order> = {}
): Order {
  return {
    code: "VSC12345678",
    uid: "uid-1",
    item,
    amount: 60_000,
    createdAt: NOW.toISOString(),
    paidBy: null,
    short: 0,
    ...fields,
  }
}

function transfer(fields: Partial<Transfer> = {}): Transfer {
  return {
    id: 92704,
    code: "VSC12345678",
    content: "VSC12345678 chuyen tien",
    transferType: "in",
    transferAmount: 60_000,
    ...fields,
  }
}

describe("matching a transfer to its order", () => {
  test("SePay's own code", () => {
    expect(orderCodeOf(transfer(), "VSC")).toBe("VSC12345678")
  })
  test("read out of the content when SePay found none", () => {
    expect(
      orderCodeOf(
        transfer({ code: null, content: "MBVCB.123 vsc12345678 tt goi" }),
        "VSC"
      )
    ).toBe("VSC12345678")
  })
  test("no code, no order", () => {
    expect(
      orderCodeOf(transfer({ code: null, content: "tien an trua" }), "VSC")
    ).toBeNull()
  })
  test("a code of the wrong shape is not one", () => {
    expect(
      orderCodeOf(transfer({ code: "VSC123", content: "VSC123" }), "VSC")
    ).toBeNull()
  })
  test("codes are the prefix and eight digits", () => {
    expect(newOrderCode("VSC")).toMatch(/^VSC\d{8}$/)
  })
  test("SePay's payload", () => {
    expect(
      transferOf({
        id: 92704,
        gateway: "Vietcombank",
        transactionDate: "2026-10-18 10:00:00",
        accountNumber: "0123499999",
        code: null,
        content: "VSC12345678",
        transferType: "in",
        transferAmount: 99000,
        accumulated: 19077000,
        subAccount: "",
        referenceCode: "MBVCB.3278907687",
        description: "",
      })
    ).toEqual({
      id: 92704,
      code: null,
      content: "VSC12345678",
      transferType: "in",
      transferAmount: 99000,
    })
  })
})

describe("applyTransfer", () => {
  test("a full transfer adds the pack's credits and marks the order paid", () => {
    const paid = applyTransfer(
      order(),
      { ...NO_ACCOUNT, credits: 5 },
      transfer()
    )
    expect(paid.kind).toBe("credits")
    if (paid.kind !== "credits") return
    expect(paid.order.paidBy).toBe(92704)
    expect(paid.account.credits).toBe(CREDIT_PACKS["credits-60k"].credits + 5)
  })

  test("more than asked still pays it", () => {
    expect(
      applyTransfer(order(), NO_ACCOUNT, transfer({ transferAmount: 100_000 }))
        .kind
    ).toBe("credits")
  })

  test("a short transfer grants nothing and is noted", () => {
    const paid = applyTransfer(
      order(),
      NO_ACCOUNT,
      transfer({ transferAmount: 50_000 })
    )
    expect(paid.kind).toBe("short")
    if (paid.kind !== "short") return
    expect(paid.order.short).toBe(50_000)
    expect(paid.order.paidBy).toBeNull()
  })

  test("a paid order is not paid twice", () => {
    expect(
      applyTransfer(order(undefined, { paidBy: 1 }), NO_ACCOUNT, transfer())
        .kind
    ).toBe("ignored")
  })

  test("money going out is not a payment", () => {
    expect(
      applyTransfer(order(), NO_ACCOUNT, transfer({ transferType: "out" })).kind
    ).toBe("ignored")
  })

  test("a plan ordered before plans were withdrawn grants nothing", () => {
    const paid = applyTransfer(
      order("plus-1m", { amount: 99_000 }),
      NO_ACCOUNT,
      transfer({ transferAmount: 99_000 })
    )
    expect(paid.kind).toBe("ignored")
  })
})

describe("webhookAuthentic", () => {
  const body = '{"id":92704}'
  const now = 1_760_000_000_000
  const ts = String(now / 1000)
  const signed = (secret: string, at = ts) =>
    new Headers({
      "x-sepay-timestamp": at,
      "x-sepay-signature": `sha256=${createHmac("sha256", secret)
        .update(`${at}.${body}`)
        .digest("hex")}`,
    })

  test("HMAC over timestamp.body", () => {
    expect(
      webhookAuthentic(body, signed("s3"), { secret: "s3", apiKey: "" }, now)
    ).toBe(true)
    expect(
      webhookAuthentic(body, signed("x"), { secret: "s3", apiKey: "" }, now)
    ).toBe(false)
  })
  test("an old timestamp, even signed", () => {
    const old = String(now / 1000 - 600)
    expect(
      webhookAuthentic(
        body,
        signed("s3", old),
        { secret: "s3", apiKey: "" },
        now
      )
    ).toBe(false)
  })
  test("an API key", () => {
    const keys = { secret: "", apiKey: "k1" }
    expect(
      webhookAuthentic(
        body,
        new Headers({ authorization: "Apikey k1" }),
        keys,
        now
      )
    ).toBe(true)
    expect(
      webhookAuthentic(
        body,
        new Headers({ authorization: "Apikey k2" }),
        keys,
        now
      )
    ).toBe(false)
  })
  test("nothing configured accepts nothing", () => {
    expect(
      webhookAuthentic(
        body,
        new Headers({ authorization: "Apikey " }),
        { secret: "", apiKey: "" },
        now
      )
    ).toBe(false)
  })
})

test("the QR carries account, bank, amount and code", () => {
  const url = new URL(
    qrUrl({ account: "0123", bank: "MBBank", amount: 99_000, code: "VSC1" })
  )
  expect(url.origin + url.pathname).toBe("https://qr.sepay.vn/img")
  expect(Object.fromEntries(url.searchParams)).toEqual({
    acc: "0123",
    bank: "MBBank",
    amount: "99000",
    des: "VSC1",
  })
})
