import { describe, expect, test } from "bun:test"

import { senderOf } from "../server/utils/email.ts"

/** `NITRO_EMAIL_FROM` as the binding's `from` — a bad one sends nothing. */

describe("senderOf", () => {
  test("a bare address is itself", () => {
    expect(senderOf(" hello@example.com ")).toBe("hello@example.com")
  })

  test("a named address is split into name and address", () => {
    expect(senderOf("Vey Studio <hello@example.com>")).toEqual({
      email: "hello@example.com",
      name: "Vey Studio",
    })
  })

  test("a quoted name loses its quotes", () => {
    expect(senderOf('"Vey Studio" <hello@example.com>')).toEqual({
      email: "hello@example.com",
      name: "Vey Studio",
    })
  })

  test("brackets with no name are the bare address", () => {
    expect(senderOf("<hello@example.com>")).toBe("hello@example.com")
  })

  test("empty or not an address is null", () => {
    expect(senderOf("")).toBe(null)
    expect(senderOf("hello")).toBe(null)
    expect(senderOf("Vey Studio <hello>")).toBe(null)
  })
})
