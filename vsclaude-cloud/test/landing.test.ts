import { describe, expect, test } from "bun:test"

import { CREDIT_PACKS } from "../server/utils/billing.ts"
import { COPY, langOf } from "../server/utils/landing-copy.ts"
import {
  formatCredits,
  landingPage,
  packsForSale,
  RELEASES_URL,
} from "../server/utils/landing.ts"

/**
 * The home page's one promise worth a test: the prices it advertises are the
 * ones the checkout charges, because both are read off `CREDIT_PACKS`.
 */

describe("packsForSale", () => {
  test("every pack on sale is drawn, cheapest first", () => {
    const packs = packsForSale()
    expect(packs.map((pack): string => pack.id)).toEqual(
      Object.entries(CREDIT_PACKS)
        .sort(([, a], [, b]) => a.price - b.price)
        .map(([id]) => id)
    )
  })

  test("one pack, at most, is the popular one", () => {
    expect(
      packsForSale().filter((pack) => pack.popular).length
    ).toBeLessThanOrEqual(1)
  })
})

describe("landingPage", () => {
  const page = landingPage("en", 2026)

  test("shows each pack's credits as the studio writes them", () => {
    for (const { credits } of Object.values(CREDIT_PACKS)) {
      expect(page).toContain(`<strong>${formatCredits(credits)}</strong>`)
    }
  })

  test("points every download at the releases page", () => {
    expect(page).toContain(`href="${RELEASES_URL}"`)
  })

  test("leaves no template hole unfilled", () => {
    expect(page).not.toContain("${")
    expect(page).not.toContain("undefined")
  })
})

describe("languages", () => {
  test("English unless Vietnamese is asked for by name", () => {
    expect(langOf("vi")).toBe("vi")
    expect(langOf("en")).toBe("en")
    expect(langOf("fr")).toBe("en")
    expect(langOf(null)).toBe("en")
  })

  test("each page is written in its own language", () => {
    expect(landingPage("en", 2026)).toContain('<html lang="en">')
    expect(landingPage("en", 2026)).toContain(COPY.en.h1[0])
    const vi = landingPage("vi", 2026)
    expect(vi).toContain('<html lang="vi">')
    expect(vi).toContain(COPY.vi.h1[0])
    expect(vi).not.toContain(COPY.en.faq.title)
  })

  test("both languages say the same number of things", () => {
    for (const key of ["pillars", "features", "steps", "faq"] as const) {
      expect(COPY.vi[key].items.length).toBe(COPY.en[key].items.length)
    }
  })

  test("the switch marks the page it is on", () => {
    expect(landingPage("vi", 2026)).toContain(
      'href="/?lang=vi" hreflang="vi" lang="vi" aria-current="true"'
    )
  })
})
