import { describe, expect, test } from "bun:test"

import { moneyOf, paymentEmail, welcomeEmail } from "../server/utils/mail.ts"
import { CREDITS_PER_USD } from "../server/utils/usage.ts"

/** The welcome and thank-you mails, as `sendEmail` is handed them. */

const USER = {
  uid: "google:1",
  email: "an@example.com",
  name: "An",
  picture: null,
}

const ORIGIN = "https://vsclaude.example"

describe("welcomeEmail", () => {
  test("goes to the user's address, by name", () => {
    const email = welcomeEmail(USER, ORIGIN)
    expect(email?.to).toBe("an@example.com")
    expect(email?.text).toStartWith("Chào An,")
    expect(email?.html).toContain("Chào An,")
  })

  test("draws the logo from this server, as a PNG", () => {
    expect(welcomeEmail(USER, `${ORIGIN}/`)?.html).toContain(
      `src="${ORIGIN}/email-logo.png"`
    )
  })

  test("a user with no name is greeted anyway", () => {
    expect(welcomeEmail({ ...USER, name: null }, ORIGIN)?.text).toStartWith(
      "Chào bạn,"
    )
  })

  test("a user with no email is sent nothing", () => {
    expect(welcomeEmail({ ...USER, email: null }, ORIGIN)).toBe(null)
  })

  test("a name is escaped in the markup", () => {
    const email = welcomeEmail({ ...USER, name: "<b>An</b>" }, ORIGIN)
    expect(email?.html).toContain("Chào &lt;b&gt;An&lt;/b&gt;")
    expect(email?.html).not.toContain("<b>An</b>")
  })
})

describe("paymentEmail", () => {
  test("says what was paid and what was added", () => {
    const email = paymentEmail(
      USER,
      {
        credits: 25 * CREDITS_PER_USD,
        amount: 50_000,
        currency: "VND",
        order: "VSC12345678",
      },
      ORIGIN
    )
    const paid = moneyOf(50_000, "VND")!
    expect(email?.text).toContain("$25.00 credits")
    expect(email?.text).toContain(paid)
    expect(email?.html).toContain("Số tiền đã thanh toán")
    expect(email?.html).toContain(paid)
    expect(email?.html).toContain("$25.00")
  })

  test("carries the order code, for the buyer to quote back", () => {
    const email = paymentEmail(
      USER,
      { credits: 1, amount: 20_000, currency: "VND", order: "VSC12345678" },
      ORIGIN
    )
    expect(email?.text).toContain("Mã đơn hàng: VSC12345678")
    expect(email?.html).toContain("Mã đơn hàng")
    expect(email?.html).toContain("VSC12345678")
  })

  test("an unknown charge leaves the amount out", () => {
    const email = paymentEmail(
      USER,
      {
        credits: 25 * CREDITS_PER_USD,
        amount: null,
        currency: null,
        order: "txn_01abc",
      },
      ORIGIN
    )
    expect(email?.text).toContain(
      "Chúng tôi đã cộng $25.00 credits vào tài khoản của bạn."
    )
    expect(email?.html).not.toContain("Số tiền đã thanh toán")
  })

  test("a user with no email is sent nothing", () => {
    expect(
      paymentEmail(
        { ...USER, email: null },
        { credits: 1, amount: 1, currency: "VND", order: "VSC1" },
        ORIGIN
      )
    ).toBe(null)
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
