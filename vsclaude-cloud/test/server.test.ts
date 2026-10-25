import { describe, expect, test } from "bun:test"
import { SignJWT } from "jose"

import {
  countBodyOf,
  mayExceed,
  promptTooLong,
  requestedModel,
} from "../server/utils/anthropic.ts"
import { authorizeUrl, userOfIdToken } from "../server/utils/google.ts"
import {
  signAccess,
  signSession,
  tokenOf,
  verifyAccess,
  verifySession,
} from "../server/utils/session.ts"
import { StreamUsage, usageOf, weighted } from "../server/utils/usage.ts"

/**
 * The parts of the server that decide who gets through and what they are
 * charged — tested without Anthropic or Google: the tokens are this server's
 * own, and Google's ID token is one the test writes.
 */

const SECRET = "test-secret-of-at-least-thirty-two-bytes"
const USER = {
  uid: "google:123",
  email: "a@example.com",
  name: "A",
  picture: null,
}

describe("session and access tokens", () => {
  test("an access token is its user", async () => {
    expect(await verifyAccess(await signAccess(USER, SECRET), SECRET)).toEqual({
      ok: true,
      user: USER,
    })
  })

  test("neither kind passes for the other", async () => {
    const session = await signSession(USER, SECRET)
    const access = await signAccess(USER, SECRET)
    expect(await verifyAccess(session, SECRET)).toEqual({
      ok: false,
      reason: "the token is not for this use",
    })
    expect((await verifySession(access, SECRET)).ok).toBe(false)
    expect((await verifySession(session, SECRET)).ok).toBe(true)
  })

  test("a token a minute past its expiry still passes", async () => {
    const now = Math.floor(Date.now() / 1000)
    const lapsed = await signAccess(USER, SECRET, now - 3660)
    expect((await verifyAccess(lapsed, SECRET)).ok).toBe(true)
  })

  test("an expired token is nobody", async () => {
    const now = Math.floor(Date.now() / 1000)
    const expired = await signAccess(USER, SECRET, now - 2 * 3600)
    expect(await verifyAccess(expired, SECRET)).toEqual({
      ok: false,
      reason: "the token has expired",
    })
  })

  test("a token signed with another secret is nobody", async () => {
    const forged = await signAccess(USER, "another-secret-of-thirty-two-bytes!")
    expect(await verifyAccess(forged, SECRET)).toEqual({
      ok: false,
      reason: "the token is not signed by this server",
    })
  })

  test("not a JWT is nobody", async () => {
    expect(await verifyAccess("sk-ant-something", SECRET)).toEqual({
      ok: false,
      reason: "the token is not a Vey Studio sign-in",
    })
  })

  test("a server with no secret signs nobody in", async () => {
    expect(await verifyAccess(await signAccess(USER, SECRET), "")).toEqual({
      ok: false,
      reason: "the server has no session secret",
    })
  })
})

describe("Google", () => {
  const google = (claims: Record<string, unknown>) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("whatever-google-signs-it-with-here"))

  test("the ID token for this client is its user", async () => {
    const token = await google({
      iss: "https://accounts.google.com",
      aud: "client-1",
      sub: "123",
      email: "a@example.com",
      email_verified: true,
      name: "A",
    })
    expect(userOfIdToken(token, "client-1")).toEqual({
      uid: "google:123",
      email: "a@example.com",
      name: "A",
      picture: null,
    })
  })

  test("another client's token is refused", async () => {
    const token = await google({
      iss: "https://accounts.google.com",
      aud: "client-2",
      sub: "123",
    })
    expect(userOfIdToken(token, "client-1")).toBe(
      "Google's ID token is for another client"
    )
  })

  test("an unverified email is not taken as theirs", async () => {
    const token = await google({
      iss: "accounts.google.com",
      aud: "client-1",
      sub: "123",
      email: "b@example.com",
      email_verified: false,
    })
    const user = userOfIdToken(token, "client-1")
    expect(typeof user !== "string" && user.email).toBeNull()
  })

  test("the way in carries the sign-in as state", () => {
    const url = new URL(
      authorizeUrl("client-1", "https://s/signin/callback", "nonce", true)
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-1",
      redirect_uri: "https://s/signin/callback",
      response_type: "code",
      scope: "openid email profile",
      state: "nonce",
      prompt: "select_account",
    })
    expect(
      new URL(
        authorizeUrl("client-1", "https://s/signin/callback", "nonce", false)
      ).searchParams.has("prompt")
    ).toBe(false)
  })
})

describe("tokenOf", () => {
  test("a bearer", () => {
    expect(tokenOf(new Headers({ authorization: "Bearer abc" }))).toBe("abc")
  })
  test("x-api-key, the CLI's other copy", () => {
    expect(tokenOf(new Headers({ "x-api-key": "abc" }))).toBe("abc")
  })
  test("neither", () => {
    expect(tokenOf(new Headers())).toBeNull()
  })
})

describe("requestedModel", () => {
  test("any model is passed on", () => {
    expect(requestedModel({ model: "claude-opus-5-5" })).toBe("claude-opus-5-5")
    expect(requestedModel({ model: "claude-sonnet-4-5" })).toBe(
      "claude-sonnet-4-5"
    )
  })
  test("a body naming none", () => {
    expect(requestedModel({})).toBeNull()
    expect(requestedModel({ model: "" })).toBeNull()
    expect(requestedModel(null)).toBeNull()
  })
})

describe("the prompt ceiling", () => {
  test("only a body longer in bytes than the ceiling needs a count", () => {
    expect(mayExceed("x".repeat(100), 100)).toBe(false)
    expect(mayExceed("x".repeat(101), 100)).toBe(true)
    // Bytes, not characters: three bytes each in UTF-8.
    expect(mayExceed("ă".repeat(40), 100)).toBe(false)
    expect(mayExceed("世".repeat(40), 100)).toBe(true)
  })

  test("count_tokens is sent only the fields it takes", () => {
    const body = JSON.parse(
      countBodyOf({
        model: "claude-haiku-5-5",
        messages: [],
        system: "s",
        tools: [],
        max_tokens: 32000,
        stream: true,
        metadata: { user_id: "u" },
      })
    )
    expect(Object.keys(body).sort()).toEqual(
      ["messages", "model", "system", "tools"].sort()
    )
  })

  test("refused in the words the CLI compacts on", async () => {
    const answer = promptTooLong(123_456, 100_000)
    expect(answer.status).toBe(400)
    const { error } = (await answer.json()) as {
      error: { type: string; message: string }
    }
    expect(error.type).toBe("invalid_request_error")
    expect(answer.headers.get("x-should-retry")).toBe("false")
    // The CLI's own pattern, copied out of its bundle.
    const match = error.message.match(
      /prompt is too long[^0-9]*(\d+)\s*tokens?\s*>\s*(\d+)/i
    )
    expect(match?.slice(1)).toEqual(["123456", "100000"])
  })
})

describe("usage", () => {
  test("weighted by price", () => {
    expect(
      weighted({
        input_tokens: 100,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1000,
        output_tokens: 10,
      })
    ).toBe(100 + 125 + 100 + 50)
  })

  test("a prompt past 100K is charged fivefold, as Anthropic charges it", () => {
    const usage = {
      input_tokens: 10,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 100_000,
      output_tokens: 100,
    }
    expect(weighted(usage)).toBe((10 + 10_000 + 500) * 5)
    expect(weighted({ ...usage, input_tokens: 0 })).toBe(10_000 + 500)
  })

  test("a non-streamed answer's usage", () => {
    expect(usageOf({ input_tokens: 5, output_tokens: 7 })).toEqual({
      input_tokens: 5,
      output_tokens: 7,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })

  test("a stream: start, then running output totals, split across chunks", () => {
    const sse = [
      "event: message_start\n",
      'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"cache_read_input_tokens":300,"output_tokens":1}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta"}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tok',
      'ens":40}}\n\n',
      'event: message_delta\r\ndata: {"type":"message_delta","usage":{"output_tokens":55}}\r\n\r\n',
    ]
    const meter = new StreamUsage()
    const encoder = new TextEncoder()
    for (const part of sse) meter.push(encoder.encode(part))
    expect(meter.usage).toEqual({
      input_tokens: 12,
      output_tokens: 55,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 300,
    })
  })
})
