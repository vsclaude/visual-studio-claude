import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"

import { NO_ACCOUNT, planOf, type Account } from "../server/utils/billing.ts"
import {
  addPrepaid,
  applyTransfer,
  isBankItem,
  newOrderCode,
  orderCodeOf,
  priceOf,
  qrUrl,
  transferOf,
  webhookAuthentic,
  type Order,
  type Transfer,
} from "../server/utils/sepay-billing.ts"

/**
 * Bank transfers through SePay: what an order costs, which transfer pays it,
 * and how a prepaid plan's days add up — with webhook payloads in the shape
 * SePay's docs give.
 */

const NOW = new Date("2026-10-18T00:00:00Z")
const DAY = 24 * 60 * 60 * 1000

function order(item: Order["item"], fields: Partial<Order> = {}): Order {
  return {
    code: "VSC12345678",
    uid: "uid-1",
    item,
    amount: priceOf(item),
    createdAt: NOW.toISOString(),
    paidBy: null,
    short: [],
    ...fields,
  }
}

function transfer(fields: Partial<Transfer> = {}): Transfer {
  return {
    id: 92704,
    code: "VSC12345678",
    content: "VSC12345678 chuyen tien",
    transferType: "in",
    transferAmount: 99_000,
    ...fields,
  }
}

const daysLeft = (account: Account) =>
  (new Date(account.prepaid?.until ?? 0).getTime() - NOW.getTime()) / DAY

describe("prices", () => {
  test("three months are three, twelve are ten", () => {
    expect(priceOf("plus-1m")).toBe(99_000)
    expect(priceOf("plus-3m")).toBe(297_000)
    expect(priceOf("plus-12m")).toBe(990_000)
    expect(priceOf("credits-60k")).toBe(60_000)
  })
  test("only what is sold", () => {
    expect(isBankItem("starter-12m")).toBe(true)
    expect(isBankItem("credits-20k")).toBe(true)
    expect(isBankItem("plus")).toBe(false)
    expect(isBankItem("pro-6m")).toBe(false)
    expect(isBankItem("hobby-1m")).toBe(false)
  })
})

describe("prepaid days", () => {
  test("a month is thirty days from now", () => {
    expect(daysLeft(addPrepaid(NO_ACCOUNT, "plus", 1, NOW))).toBe(30)
  })

  test("the same plan again extends it", () => {
    const once = addPrepaid(NO_ACCOUNT, "plus", 1, NOW)
    expect(daysLeft(addPrepaid(once, "plus", 3, NOW))).toBe(120)
  })

  test("an upgrade carries the days left over by value", () => {
    // Thirty days of Starter are worth 49/299 of thirty days of Pro.
    const starter = addPrepaid(NO_ACCOUNT, "starter", 1, NOW)
    const pro = addPrepaid(starter, "pro", 1, NOW)
    expect(pro.prepaid?.id).toBe("pro")
    expect(daysLeft(pro)).toBeCloseTo(30 + (30 * 49_000) / 299_000, 5)
  })

  test("an expired plan carries nothing", () => {
    const old = addPrepaid(
      NO_ACCOUNT,
      "pro",
      1,
      new Date(NOW.getTime() - 60 * DAY)
    )
    expect(daysLeft(addPrepaid(old, "starter", 1, NOW))).toBe(30)
  })

  test("the plan holds until its day, then Hobby", () => {
    const plus = addPrepaid(NO_ACCOUNT, "plus", 1, NOW)
    expect(planOf(plus, NOW)).toBe("plus")
    expect(planOf(plus, new Date(NOW.getTime() + 31 * DAY))).toBe("hobby")
  })
})

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
  test("a full transfer grants the plan and marks the order paid", () => {
    const paid = applyTransfer(order("plus-1m"), NO_ACCOUNT, transfer(), NOW)
    expect(paid.kind).toBe("plan")
    if (paid.kind !== "plan") return
    expect(paid.order.paidBy).toBe(92704)
    expect(planOf(paid.account, NOW)).toBe("plus")
  })

  test("more than asked still pays it", () => {
    expect(
      applyTransfer(
        order("plus-1m"),
        NO_ACCOUNT,
        transfer({ transferAmount: 100_000 }),
        NOW
      ).kind
    ).toBe("plan")
  })

  test("a short transfer grants nothing and is noted", () => {
    const paid = applyTransfer(
      order("plus-1m"),
      NO_ACCOUNT,
      transfer({ transferAmount: 50_000 }),
      NOW
    )
    expect(paid.kind).toBe("short")
    if (paid.kind !== "short") return
    expect(paid.order.short).toEqual([{ id: 92704, amount: 50_000 }])
    expect(paid.order.paidBy).toBeNull()
  })

  test("a paid order is not paid twice", () => {
    expect(
      applyTransfer(
        order("plus-1m", { paidBy: 1 }),
        NO_ACCOUNT,
        transfer(),
        NOW
      ).kind
    ).toBe("ignored")
  })

  test("money going out is not a payment", () => {
    expect(
      applyTransfer(
        order("plus-1m"),
        NO_ACCOUNT,
        transfer({ transferType: "out" }),
        NOW
      ).kind
    ).toBe("ignored")
  })

  test("a credit pack adds its credits", () => {
    const paid = applyTransfer(
      order("credits-60k"),
      { ...NO_ACCOUNT, credits: 5 },
      transfer({ transferAmount: 60_000 }),
      NOW
    )
    expect(paid.kind === "credits" && paid.account.credits).toBe(3_300_005)
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
