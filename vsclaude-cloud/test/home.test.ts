import { describe, expect, test } from "bun:test"

import { CREDIT_PACKS } from "../server/utils/billing.ts"
import {
  COPY,
  docsPathOf,
  docsStartOf,
  installPathOf,
  langOf,
  pathOf,
} from "../site/.vitepress/theme/copy.ts"
import {
  formatCredits,
  packsForSale,
} from "../site/.vitepress/theme/home/packs.ts"
import { hashOf, osOfHash } from "../site/.vitepress/theme/download.ts"
import { slugOf } from "../site/.vitepress/theme/links.ts"

/**
 * The home page's one promise worth a test: the prices it advertises are the
 * ones the checkout charges, because both are read off `CREDIT_PACKS`. The
 * page itself is `site/` (VitePress); what is tested here is what it draws.
 */

describe("packsForSale", () => {
  test("every pack on sale is drawn, cheapest first, retired ones not", () => {
    const packs = packsForSale()
    expect(packs.map((pack): string => pack.id)).toEqual(
      Object.entries(CREDIT_PACKS)
        .filter(([, pack]) => !pack.retired)
        .sort(([, a], [, b]) => a.price - b.price)
        .map(([id]) => id)
    )
    expect(packs.map((pack): string => pack.id)).toEqual([
      "vnd-20k",
      "vnd-50k",
      "vnd-100k",
      "vnd-200k",
    ])
  })

  test("shows each pack's credits as the studio writes them", () => {
    expect(packsForSale().map((pack) => pack.credits)).toEqual([
      "$10.00",
      "$25.00",
      "$55.00",
      "$120.00",
    ])
    expect(packsForSale()[0]!.credits).toBe(
      formatCredits(CREDIT_PACKS["vnd-20k"].credits)
    )
  })

  test("nothing is sold by card", () => {
    expect(packsForSale("card")).toEqual([])
  })

  test("one pack, at most, is the popular one", () => {
    expect(
      packsForSale().filter((pack) => pack.popular).length
    ).toBeLessThanOrEqual(1)
  })
})

describe("languages", () => {
  test("English unless Vietnamese is asked for by name", () => {
    expect(langOf("vi")).toBe("vi")
    expect(langOf("en")).toBe("en")
    expect(langOf("fr")).toBe("en")
    expect(langOf(null)).toBe("en")
  })

  test("each language's home and guide are VitePress's locales", () => {
    expect(pathOf("en")).toBe("/")
    expect(pathOf("vi")).toBe("/vi/")
    expect(docsPathOf("en")).toBe("/docs/")
    expect(docsPathOf("vi")).toBe("/vi/docs/")
    expect(docsStartOf("en")).toBe("/docs/getting-started")
    expect(docsStartOf("vi")).toBe("/vi/docs/getting-started")
    expect(installPathOf("en")).toBe("/install")
    expect(installPathOf("vi")).toBe("/vi/install")
  })

  test("the switch goes to the same page in the other language", () => {
    expect(slugOf("index.md")).toBe("")
    expect(slugOf("vi/index.md")).toBe("")
    expect(slugOf("docs/index.md")).toBe("docs/")
    expect(slugOf("vi/docs/credits.md")).toBe("docs/credits")
    expect(slugOf("vi/install.md")).toBe("install")
  })

  test("the install page's address names its tab", () => {
    expect(hashOf("macOS")).toBe("#macos")
    expect(hashOf("Windows")).toBe("#windows")
    expect(osOfHash("#linux")).toBe("Linux")
    expect(osOfHash("#macOS")).toBe("macOS")
    expect(osOfHash("")).toBeNull()
    expect(osOfHash("#ios")).toBeNull()
  })

  test("both languages say the same number of things", () => {
    for (const key of ["pillars", "features", "steps", "faq"] as const) {
      expect(COPY.vi[key].items.length).toBe(COPY.en[key].items.length)
    }
    expect(COPY.vi.install.after.items.map((item) => item.doc)).toEqual(
      COPY.en.install.after.items.map((item) => item.doc)
    )
  })
})
