import { describe, expect, test } from "bun:test"

import { PRO_PLANS } from "../server/utils/billing.ts"
import {
  COPY,
  docsPathOf,
  docsStartOf,
  installPathOf,
  langOf,
  pathOf,
} from "../site/.vitepress/theme/copy.ts"
import { hashOf, osOfHash } from "../site/.vitepress/theme/download.ts"
import { slugOf } from "../site/.vitepress/theme/links.ts"
import { formatVnd } from "../site/.vitepress/theme/copy.ts"

/**
 * The home page's one promise worth a test: the prices it advertises for Pro
 * are the ones the checkout charges, because both are read off `PRO_PLANS`.
 * The page itself is `site/` (VitePress); what is tested here is what it
 * draws.
 */

describe("pricing", () => {
  test("Free, then a card per device plan at the price charged", () => {
    for (const lang of ["en", "vi"] as const) {
      const [free, ...devices] = COPY[lang].pricing.plans
      expect(free?.pro).toBeUndefined()
      expect(devices.map((plan) => plan.price)).toEqual(
        PRO_PLANS.map((plan) => formatVnd(plan.price))
      )
      expect(devices.filter((plan) => plan.flag)).toHaveLength(1)
    }
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
    expect(slugOf("vi/docs/pro.md")).toBe("docs/pro")
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
