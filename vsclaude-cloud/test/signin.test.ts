import { describe, expect, test } from "bun:test"

import { isNonce, parseAnswer, signInPage } from "../server/utils/signin.ts"

/**
 * The sign-in routes' own decisions: which paths are an attempt, which bodies
 * are an answer, and that the page posts where the routes listen. The storage
 * half is KV's.
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
  })
})

describe("parseAnswer", () => {
  test("a token is an answer", () => {
    expect(parseAnswer('{"idToken":"x"}')).toEqual({ idToken: "x" })
  })

  test("an error is an answer", () => {
    expect(parseAnswer('{"error":"no"}')).toEqual({ error: "no" })
  })

  test("anything else is refused", () => {
    expect(parseAnswer("not json")).toBeNull()
    expect(parseAnswer("[]")).toBeNull()
    expect(parseAnswer("42")).toBeNull()
    expect(parseAnswer("{}")).toBeNull()
    expect(parseAnswer('{"idToken":42}')).toBeNull()
    expect(parseAnswer('{"idToken":""}')).toBeNull()
  })
})

describe("signInPage", () => {
  const page = signInPage()

  test("posts its answer to the route that keeps it", () => {
    expect(page).toContain('fetch("/api/signin/"')
  })

  test("runs Firebase's popup for the studio's project", () => {
    expect(page).toContain("firebase-auth.js")
    expect(page).toContain('"projectId":"simm-chat"')
  })

  test("asks for an account only when the link is pressed", () => {
    expect(page).toContain(
      'if (chooseAccount) provider.setCustomParameters({ prompt: "select_account" })'
    )
    expect(page).toContain(
      'other.addEventListener("click", () => signIn(true))'
    )
  })
})
