import { describe, expect, test } from "bun:test"

import { appUsageOf, countryOf } from "../server/utils/app-usage.ts"

/**
 * What `POST /api/telemetry` will write. It takes no sign-in, so this check is
 * the whole of what stands between a caller and a row.
 */

const OPENED = {
  installId: "3F2B8C1E-9A4D-4E7B-8C2A-1D5E6F7A8B9C",
  event: "app_opened",
  version: "1.0.21",
  os: "darwin",
  arch: "arm64",
}

describe("appUsageOf", () => {
  test("an open is a row with no seconds, under a lower-case id", () => {
    expect(appUsageOf(OPENED)).toEqual({
      installId: "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c",
      event: "app_opened",
      activeSeconds: null,
      version: "1.0.21",
      os: "darwin",
      arch: "arm64",
    })
  })

  test("an open's stray seconds are not kept", () => {
    const usage = appUsageOf({ ...OPENED, activeSeconds: 600 })
    expect(typeof usage !== "string" && usage.activeSeconds).toBe(null)
  })

  test("a heartbeat carries its seconds", () => {
    const usage = appUsageOf({
      ...OPENED,
      event: "heartbeat",
      activeSeconds: 900,
    })
    expect(typeof usage !== "string" && usage.activeSeconds).toBe(900)
  })

  test("a heartbeat without sane seconds is refused", () => {
    for (const activeSeconds of [undefined, 0, -60, 1.5, 3601, "900"]) {
      expect(
        typeof appUsageOf({ ...OPENED, event: "heartbeat", activeSeconds })
      ).toBe("string")
    }
  })

  test("anything but the two events is refused", () => {
    expect(typeof appUsageOf({ ...OPENED, event: "chat_sent" })).toBe("string")
  })

  test("fields out of shape are refused", () => {
    for (const bad of [
      { installId: "not-a-uuid" },
      { version: "latest" },
      { version: "1.0.21".padEnd(64, "x") },
      { os: "Mac OS X" },
      { arch: "" },
    ]) {
      expect(typeof appUsageOf({ ...OPENED, ...bad })).toBe("string")
    }
    expect(typeof appUsageOf(null)).toBe("string")
    expect(typeof appUsageOf("app_opened")).toBe("string")
  })
})

describe("countryOf", () => {
  test("a two-letter code is kept", () => {
    expect(countryOf("VN")).toBe("VN")
  })

  test("Cloudflare's unknowns and anything else are none", () => {
    for (const value of ["XX", "T1", "vn", "VNM", "", null, undefined]) {
      expect(countryOf(value)).toBe(null)
    }
  })
})
