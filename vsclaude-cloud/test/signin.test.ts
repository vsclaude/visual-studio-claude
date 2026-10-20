import { describe, expect, test } from "bun:test"

import { isNonce, signInPage } from "../server/utils/signin.ts"

/**
 * The sign-in routes' own decisions: which paths are an attempt, and what the
 * page offers before Google and says after it. The storage half is D1's.
 */

describe("isNonce", () => {
  test("24 random bytes as base64url are one", () => {
    expect(isNonce("8Blmm0_ofvUXzW_Tk0hWqUrj19oH3RIj")).toBe(true)
  })

  test("anything shorter, longer or outside the alphabet is not", () => {
    expect(isNonce("short")).toBe(false)
    expect(isNonce("8Blmm0_ofvUXzW_Tk0hWqUrj19oH3RIjX")).toBe(false)
    expect(isNonce("8Blmm0_ofvUXzW_Tk0hWqUrj19oH3RI:")).toBe(false)
    expect(isNonce("")).toBe(false)
    expect(isNonce("callback")).toBe(false)
  })
})

describe("signInPage", () => {
  test("links to Google, once as is and once choosing an account", () => {
    const page = signInPage({
      kind: "start",
      google: "https://accounts.google.com/a?x=1&y=2",
      chooseAccount: "https://accounts.google.com/b",
    })
    expect(page).toContain('href="https://accounts.google.com/a?x=1&amp;y=2"')
    expect(page).toContain('href="https://accounts.google.com/b"')
    expect(page).not.toContain("<script")
  })

  test("says when it is done", () => {
    expect(signInPage({ kind: "done" })).toContain("You're signed in")
  })

  test("says why it failed, escaped", () => {
    const page = signInPage({ kind: "failed", reason: "<b>no</b>" })
    expect(page).toContain("&lt;b&gt;no&lt;/b&gt;")
    expect(page).not.toContain("<b>no</b>")
  })
})
