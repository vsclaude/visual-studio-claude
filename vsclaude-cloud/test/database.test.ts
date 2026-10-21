import { describe, expect, test } from "bun:test"

import { isNoSuch } from "../server/utils/database.ts"

/**
 * Which failures `hasColumn` may read as "the old layout". A yes is what drops
 * `transactions`, so anything else — D1 down, a timeout — has to be a no.
 */

describe("isNoSuch", () => {
  test("SQLite's missing column or table is one", () => {
    expect(
      isNoSuch(new Error("D1_ERROR: no such column: provider: SQLITE_ERROR"))
    ).toBe(true)
    expect(isNoSuch(new Error("no such table: transactions"))).toBe(true)
  })

  test("found on a wrapped error's cause too", () => {
    const cause = new Error("D1_ERROR: no such column: token: SQLITE_ERROR")
    expect(isNoSuch(new Error("Query failed", { cause }))).toBe(true)
  })

  test("any other failure is not", () => {
    expect(isNoSuch(new Error("D1_ERROR: Network connection lost."))).toBe(
      false
    )
    expect(isNoSuch(new Error("D1 DB is overloaded."))).toBe(false)
    expect(isNoSuch(undefined)).toBe(false)
  })
})
