import { describe, expect, test } from "bun:test"

import { moneyOf, proEmail } from "../server/utils/mail.ts"

/** The Vey Pro mail, as `sendEmail` is handed it. */

const ORIGIN = "https://vsclaude.example"

describe("proEmail", () => {
  const purchase = {
    to: "an@example.com",
    key: "VEY-AB12-CD34-EF56-GH78",
    seats: 3,
    amount: 199_000,
    order: "VSC12345678",
  }

  test("goes to the buyer, with the key in it", () => {
    const email = proEmail(purchase, ORIGIN)
    expect(email.to).toBe("an@example.com")
    expect(email.text).toContain("VEY-AB12-CD34-EF56-GH78")
    expect(email.html).toContain("VEY-AB12-CD34-EF56-GH78")
  })

  test("says how many devices, and how to use it on another", () => {
    const email = proEmail(purchase, ORIGIN)
    expect(email.text).toContain("3 thiết bị")
    expect(email.text).toContain("Đã có khoá?")
  })

  test("says what was paid, the order code, and the refund window", () => {
    const email = proEmail(purchase, ORIGIN)
    expect(email.text).toContain(moneyOf(199_000, "VND")!)
    expect(email.text).toContain("Mã đơn hàng: VSC12345678")
    expect(email.html).toContain("Số tiền đã thanh toán")
    expect(email.text).toContain("7 ngày")
  })

  test("draws the logo from this server, as a PNG", () => {
    expect(proEmail(purchase, `${ORIGIN}/`).html).toContain(
      `${ORIGIN}/email-logo.png`
    )
  })
})

describe("moneyOf", () => {
  test("đồng have no decimals; cents are a hundredth", () => {
    expect(moneyOf(50_000, "VND")).toContain("50.000")
    expect(moneyOf(2_500, "usd")).toContain("25,00")
  })

  test("nothing known is null", () => {
    expect(moneyOf(null, "VND")).toBe(null)
    expect(moneyOf(100, null)).toBe(null)
    expect(moneyOf(100, "NOT A CURRENCY")).toBe(null)
  })
})
