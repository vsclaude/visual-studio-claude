import { describe, expect, test } from "bun:test"

import { CREDIT_PACKS } from "../server/utils/billing.ts"
import {
  COPY,
  docsPathOf,
  docsStartOf,
  langOf,
  pathOf,
} from "../site/.vitepress/theme/copy.ts"
import {
  formatCredits,
  packsForSale,
} from "../site/.vitepress/theme/home/packs.ts"
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
    expect(packs.map((pack): string => pack.id)).toEqual(["vnd-20k"])
  })

  test("shows each pack's credits as the studio writes them", () => {
    expect(packsForSale().map((pack) => pack.credits)).toEqual(["$10.00"])
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
  })

  test("the switch goes to the same page in the other language", () => {
    expect(slugOf("index.md")).toBe("")
    expect(slugOf("vi/index.md")).toBe("")
    expect(slugOf("docs/index.md")).toBe("docs/")
    expect(slugOf("vi/docs/credits.md")).toBe("docs/credits")
  })

  test("both languages say the same number of things", () => {
    for (const key of ["pillars", "features", "steps", "faq"] as const) {
      expect(COPY.vi[key].items.length).toBe(COPY.en[key].items.length)
    }
  })
})
