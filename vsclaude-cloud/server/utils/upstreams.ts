/**
 * Where a request is forwarded: one or more providers speaking Anthropic's
 * Messages API, each its own base URL and key, tried in the order configured.
 *
 * **Failover, not load-spreading.** The first provider that is not cooling
 * down gets every request; the next is asked only when that one fails in a
 * way another provider could answer differently — unreachable, out of
 * balance, refusing its key, overloaded, not serving the model. A refusal of
 * the request itself (a malformed body, a prompt over the window) is the
 * client's and goes back at once: every provider would say the same.
 *
 * Failover happens only **before the answer starts**: once a provider has
 * answered 200 and the stream is flowing to the CLI, it is that provider's
 * answer to finish, since half a reply cannot be replayed elsewhere.
 *
 * A provider that failed is skipped for a while (`cooldownFor`) so every
 * request is not one wasted round trip to it first. That memory is per
 * isolate on Workers — a fresh one tries the dead provider once and learns
 * again — which is cheap enough not to keep in D1.
 *
 * Keys are never logged, only the provider's `name`.
 */

export type Upstream = {
  /** What the log calls it — never the key. */
  name: string
  /** Up to the part before `/v1/messages`, with any path prefix the provider
   * needs (`https://example.com/api`). */
  baseUrl: string
  apiKey: string
  /** How the key is sent: Anthropic's `x-api-key`, or the
   * `Authorization: Bearer` many resellers expect instead. */
  auth: "x-api-key" | "bearer"
}

/**
 * The providers, out of the `upstreams` table's rows (`upstream-store.ts`
 * reads them, enabled ones only, in `priority` order). There is no fallback:
 * an empty table is a server with nowhere to send a request, and says so
 * (`The server has no API key.`) rather than quietly using a key from its
 * environment that nobody remembers is there. A row missing its URL or key is
 * dropped rather than failing every request.
 */
export function upstreamsFrom(
  rows: readonly Record<string, unknown>[]
): Upstream[] {
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim() : ""
  return rows.flatMap((row): Upstream[] => {
    const name = text(row.name)
    const baseUrl = text(row.base_url)
    const apiKey = text(row.api_key)
    if (!name || !baseUrl || !apiKey) return []
    return [
      {
        name,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiKey,
        auth: row.auth === "bearer" ? "bearer" : "x-api-key",
      },
    ]
  })
}

/** `baseUrl` + the path the CLI asked for, keeping a provider's own prefix —
 * `new URL("/v1/messages", base)` would drop it. */
export function urlOf(upstream: Upstream, path: string): string {
  return `${upstream.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

/** The request headers a provider is sent: the protocol's own and its key,
 * never the client's credentials — those were for this server. */
export function headersFor(upstream: Upstream, from: Headers): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    "anthropic-version": from.get("anthropic-version") ?? "2023-06-01",
  })
  if (upstream.auth === "bearer") {
    headers.set("authorization", `Bearer ${upstream.apiKey}`)
  } else {
    headers.set("x-api-key", upstream.apiKey)
  }
  const beta = from.get("anthropic-beta")
  if (beta) headers.set("anthropic-beta", beta)
  const accept = from.get("accept")
  if (accept) headers.set("accept", accept)
  return headers
}

/**
 * Whether an answer is the provider's failure rather than the request's —
 * worth asking the next one. A 400 is the request's unless it talks about
 * money: resellers say "insufficient balance" or "quota" with a 400 as often
 * as a 402. `prompt is too long` stays the request's, since the CLI compacts
 * on it.
 */
export function failsOver(status: number, body: string): boolean {
  if (status === 400) {
    return /credit|balance|quota|insufficient|billing|payment/i.test(body)
  }
  return [401, 402, 403, 404, 408, 429].includes(status) || status >= 500
}

/** How long a provider is skipped after failing: long for a key or a balance,
 * which do not fix themselves in a minute, short for being busy. */
export function cooldownFor(status: number | "unreachable"): number {
  if (status === 401 || status === 402 || status === 403 || status === 400) {
    return 10 * 60_000
  }
  return 60_000
}

/** Provider name → until when it is skipped. */
export type Cooling = Map<string, number>

const COOLING: Cooling = new Map()

/**
 * The order to try the providers in: the configured order, those cooling down
 * moved to the back rather than dropped — when every one has failed lately,
 * trying them all again is better than refusing outright.
 */
export function orderOf(
  upstreams: Upstream[],
  cooling: Cooling,
  now: number
): Upstream[] {
  const warm = upstreams.filter((up) => (cooling.get(up.name) ?? 0) <= now)
  const cold = upstreams.filter((up) => (cooling.get(up.name) ?? 0) > now)
  return [...warm, ...cold]
}

export type Sent =
  /** A provider answered — successfully, or with the request's own error, or
   * the last provider's failure when every one failed. */
  | {
      kind: "answered"
      upstream: Upstream
      response: Response
      tried: string[]
    }
  /** None could be reached at all. */
  | { kind: "unreachable"; tried: string[] }
  | { kind: "aborted" }

/**
 * Sends one request down the providers until one answers in a way worth
 * passing on. A failing answer that is not the last is read and dropped; the
 * last one's is passed on as it came, so the CLI sees a real error.
 */
export async function send(
  upstreams: Upstream[],
  request: {
    path: string
    headers: Headers
    body: string
    signal: AbortSignal
  },
  options: {
    cooling?: Cooling
    now?: () => number
    fetch?: typeof fetch
  } = {}
): Promise<Sent> {
  const cooling = options.cooling ?? COOLING
  const now = options.now ?? Date.now
  const call = options.fetch ?? fetch
  const order = orderOf(upstreams, cooling, now())
  const tried: string[] = []
  let last: { upstream: Upstream; response: Response } | null = null

  for (const [index, upstream] of order.entries()) {
    tried.push(upstream.name)
    let response: Response
    try {
      response = await call(urlOf(upstream, request.path), {
        method: "POST",
        headers: headersFor(upstream, request.headers),
        body: request.body,
        signal: request.signal,
      })
    } catch {
      if (request.signal.aborted) return { kind: "aborted" }
      cooling.set(upstream.name, now() + cooldownFor("unreachable"))
      continue
    }
    if (response.ok) {
      cooling.delete(upstream.name)
      return { kind: "answered", upstream, response, tried }
    }

    // Small, and needed whole to tell a balance refusal from a bad request.
    const text = await response.text().catch(() => "")
    const rebuilt = new Response(text, {
      status: response.status,
      headers: response.headers,
    })
    if (!failsOver(response.status, text)) {
      return { kind: "answered", upstream, response: rebuilt, tried }
    }
    cooling.set(upstream.name, now() + cooldownFor(response.status))
    console.warn(
      `upstream ${upstream.name} answered ${response.status}: ${text.slice(0, 200)}`
    )
    last = { upstream, response: rebuilt }
    if (index === order.length - 1) break
  }

  return last
    ? { kind: "answered", ...last, tried }
    : { kind: "unreachable", tried }
}
