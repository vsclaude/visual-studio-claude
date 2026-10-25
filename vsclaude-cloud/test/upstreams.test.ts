import { describe, expect, test } from "bun:test"

import {
  failsOver,
  headersFor,
  orderOf,
  send,
  upstreamsFrom,
  urlOf,
  type Cooling,
  type Upstream,
} from "../server/utils/upstreams.ts"

/**
 * The providers a request is forwarded to, and the failover between them —
 * driven by a fake `fetch` that answers per provider, so what is checked is
 * which provider was asked, in what order, and what the CLI is handed back.
 */

const up = (name: string, extra: Partial<Upstream> = {}): Upstream => ({
  name,
  baseUrl: `https://${name}.example/api`,
  apiKey: `sk-${name}`,
  auth: "x-api-key",
  ...extra,
})

describe("upstreamsFrom", () => {
  test("the table's rows, in the order read", () => {
    const rows = [
      {
        name: "a",
        base_url: "https://a.example/",
        api_key: " k1 ",
        auth: "x-api-key",
      },
      {
        name: "b",
        base_url: "https://b.example",
        api_key: "k2",
        auth: "bearer",
      },
    ]
    expect(upstreamsFrom(rows)).toEqual([
      {
        name: "a",
        baseUrl: "https://a.example",
        apiKey: "k1",
        auth: "x-api-key",
      },
      { name: "b", baseUrl: "https://b.example", apiKey: "k2", auth: "bearer" },
    ])
  })
  test("a row without a name, a URL or a key is dropped", () => {
    expect(
      upstreamsFrom([
        { name: "a", base_url: "https://a.example", api_key: "" },
        { name: "", base_url: "https://b.example", api_key: "k" },
        { name: "c", base_url: null, api_key: "k" },
      ])
    ).toEqual([])
  })
  test("no rows is no providers — there is no fallback key", () => {
    expect(upstreamsFrom([])).toEqual([])
  })
})

describe("one provider's request", () => {
  test("its path prefix is kept", () => {
    expect(urlOf(up("a"), "/v1/messages?beta=true")).toBe(
      "https://a.example/api/v1/messages?beta=true"
    )
  })
  test("the user's token never goes to a provider", () => {
    const from = new Headers({
      authorization: "Bearer user-token",
      "x-api-key": "user-token",
      "anthropic-beta": "prompt-caching-2024-07-31",
    })
    const plain = headersFor(up("a"), from)
    expect(plain.get("x-api-key")).toBe("sk-a")
    expect(plain.get("authorization")).toBeNull()
    expect(plain.get("anthropic-beta")).toBe("prompt-caching-2024-07-31")
    const bearer = headersFor(up("b", { auth: "bearer" }), from)
    expect(bearer.get("authorization")).toBe("Bearer sk-b")
    expect(bearer.get("x-api-key")).toBeNull()
  })
})

describe("failsOver", () => {
  test("the provider's failures", () => {
    for (const status of [401, 402, 403, 404, 429, 500, 502, 503, 529]) {
      expect(failsOver(status, "")).toBe(true)
    }
    expect(failsOver(400, '{"error":{"message":"Insufficient balance"}}')).toBe(
      true
    )
    expect(failsOver(400, "Your credit balance is too low")).toBe(true)
  })
  test("the request's own, which every provider would refuse", () => {
    expect(failsOver(400, "prompt is too long: 120000 tokens > 100000")).toBe(
      false
    )
    expect(failsOver(400, "messages: field required")).toBe(false)
    expect(failsOver(413, "")).toBe(false)
  })
})

describe("orderOf", () => {
  test("cooling providers go to the back, not away", () => {
    const cooling: Cooling = new Map([["a", 2_000]])
    const names = (list: Upstream[]) => list.map((u) => u.name)
    expect(names(orderOf([up("a"), up("b")], cooling, 1_000))).toEqual([
      "b",
      "a",
    ])
    expect(names(orderOf([up("a"), up("b")], cooling, 3_000))).toEqual([
      "a",
      "b",
    ])
  })
})

/** A fetch answering per provider, recording who was asked. */
function fakeFetch(
  answers: Record<string, () => Response | Promise<Response>>
): { fetch: typeof fetch; asked: string[] } {
  const asked: string[] = []
  const fake = (async (input: RequestInfo | URL) => {
    const host = new URL(String(input)).hostname.split(".")[0]!
    asked.push(host)
    return answers[host]!()
  }) as typeof fetch
  return { fetch: fake, asked }
}

const request = () => ({
  path: "/v1/messages",
  headers: new Headers(),
  body: "{}",
  signal: new AbortController().signal,
})

describe("send", () => {
  test("the first that answers is the only one asked", async () => {
    const { fetch, asked } = fakeFetch({
      a: () => new Response("ok"),
      b: () => new Response("never"),
    })
    const sent = await send([up("a"), up("b")], request(), {
      fetch,
      cooling: new Map(),
    })
    expect(asked).toEqual(["a"])
    expect(sent.kind === "answered" && sent.upstream.name).toBe("a")
  })

  test("out of balance, refused, unreachable: on to the next", async () => {
    const { fetch, asked } = fakeFetch({
      a: () => new Response("insufficient balance", { status: 400 }),
      b: () => {
        throw new TypeError("fetch failed")
      },
      c: () => new Response("bad key", { status: 401 }),
      d: () => new Response("ok"),
    })
    const cooling: Cooling = new Map()
    const sent = await send([up("a"), up("b"), up("c"), up("d")], request(), {
      fetch,
      cooling,
      now: () => 0,
    })
    expect(asked).toEqual(["a", "b", "c", "d"])
    expect(sent.kind === "answered" && sent.upstream.name).toBe("d")
    expect(sent.kind === "answered" && sent.tried).toEqual(["a", "b", "c", "d"])
    // The three that failed are skipped by the next request.
    expect([...cooling.keys()].sort()).toEqual(["a", "b", "c"])
  })

  test("the request's own error goes back at once", async () => {
    const { fetch, asked } = fakeFetch({
      a: () => new Response("prompt is too long", { status: 400 }),
      b: () => new Response("ok"),
    })
    const sent = await send([up("a"), up("b")], request(), {
      fetch,
      cooling: new Map(),
    })
    expect(asked).toEqual(["a"])
    expect(sent.kind === "answered" && sent.response.status).toBe(400)
    expect(sent.kind === "answered" ? await sent.response.text() : "").toBe(
      "prompt is too long"
    )
  })

  test("every one failing hands back the last one's real error", async () => {
    const { fetch } = fakeFetch({
      a: () => new Response("busy", { status: 529 }),
      b: () => new Response("no balance", { status: 402 }),
    })
    const sent = await send([up("a"), up("b")], request(), {
      fetch,
      cooling: new Map(),
    })
    expect(sent.kind === "answered" && sent.response.status).toBe(402)
    expect(sent.kind === "answered" ? await sent.response.text() : "").toBe(
      "no balance"
    )
  })

  test("none reachable at all", async () => {
    const { fetch } = fakeFetch({
      a: () => {
        throw new TypeError("fetch failed")
      },
    })
    const sent = await send([up("a")], request(), {
      fetch,
      cooling: new Map(),
    })
    expect(sent).toEqual({ kind: "unreachable", tried: ["a"] })
  })

  test("a stopped chat is not a provider failing", async () => {
    const controller = new AbortController()
    const { fetch, asked } = fakeFetch({
      a: () => {
        controller.abort()
        throw new DOMException("aborted", "AbortError")
      },
      b: () => new Response("ok"),
    })
    const cooling: Cooling = new Map()
    const sent = await send(
      [up("a"), up("b")],
      { ...request(), signal: controller.signal },
      { fetch, cooling }
    )
    expect(sent.kind).toBe("aborted")
    expect(asked).toEqual(["a"])
    expect(cooling.size).toBe(0)
  })

  test("a provider that answers again is warm again", async () => {
    const cooling: Cooling = new Map([["a", 5]])
    const { fetch } = fakeFetch({
      a: () => new Response("ok"),
    })
    await send([up("a")], request(), { fetch, cooling, now: () => 10 })
    expect(cooling.has("a")).toBe(false)
  })
})
