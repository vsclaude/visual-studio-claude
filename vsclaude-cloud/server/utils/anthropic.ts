/**
 * Talking to Anthropic on the user's behalf, and answering the CLI in
 * Anthropic's own shapes.
 *
 * Errors go back as Anthropic's error body (`{ type: "error", error: { type,
 * message } }`) with Anthropic's status codes, because the client is Claude
 * Code: it reads those, shows the message, and decides on its own whether to
 * retry — a 429 it backs off from, a 403 it does not.
 *
 * Except that this server's own refusals say `x-should-retry: false`, which the
 * CLI obeys over its status rules: a missing key is a 500, which it would
 * otherwise retry ten times with backoff, leaving
 * the chat "working" for minutes on an answer that will not change. A 502 —
 * Anthropic unreachable — is the one worth retrying.
 *
 * Which provider a request goes to, and the failover between them, is
 * `upstreams.ts`.
 */

import { send, type Upstream } from "./upstreams.ts"

export function anthropicError(
  status: number,
  type: string,
  message: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({ type: "error", error: { type, message } }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "x-should-retry": status === 502 ? "true" : "false",
        ...headers,
      },
    }
  )
}

/**
 * The model a request asked for, or null for a body that names none.
 *
 * Any model is passed on — there is no list of the ones served any more
 * (`NITRO_ALLOWED_MODELS`, removed). It is charged by its family's price
 * (`usage.ts`), an unknown family at Opus's.
 */
export function requestedModel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const model = (body as Record<string, unknown>).model
  return typeof model === "string" && model ? model : null
}

/** The response headers the CLI is passed back: what it reads to decide on a
 * retry and to name a request in a bug report. */
export function downstreamHeaders(from: Headers): Headers {
  const headers = new Headers()
  for (const name of [
    "content-type",
    "request-id",
    "retry-after",
    "x-should-retry",
  ]) {
    const value = from.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

/**
 * Whether a body could be a prompt over `max` tokens. Every token is at least
 * one byte of what was sent — text tokens cover one or more characters and
 * images are base64, far more bytes than tokens — so a body no longer than
 * `max` bytes needs no count, and only the long ones pay for a round trip.
 */
export function mayExceed(text: string, max: number): boolean {
  return new TextEncoder().encode(text).length > max
}

/**
 * The fields of a Messages body that `count_tokens` takes. It refuses the rest
 * (`max_tokens`, `stream`, `metadata`…) rather than ignoring them.
 */
const COUNTED_FIELDS = [
  "model",
  "messages",
  "system",
  "tools",
  "tool_choice",
  "thinking",
  "mcp_servers",
  "context_management",
  "output_config",
  "output_format",
]

export function countBodyOf(body: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      COUNTED_FIELDS.filter((key) => key in body).map((key) => [key, body[key]])
    )
  )
}

/**
 * The size of a prompt as the providers count it, or null when none could say
 * — many resellers serve no `count_tokens` at all. The caller lets the request
 * through then, since `weighted` charges a long prompt at its real price out
 * of the credits.
 */
export async function countTokens(
  body: Record<string, unknown>,
  init: {
    upstreams: Upstream[]
    search: string
    headers: Headers
    signal: AbortSignal
  }
): Promise<number | null> {
  try {
    const sent = await send(init.upstreams, {
      path: `/v1/messages/count_tokens${init.search}`,
      headers: init.headers,
      body: countBodyOf(body),
      signal: init.signal,
    })
    if (sent.kind !== "answered") return null
    if (!sent.response.ok) {
      console.warn(
        "count_tokens answered",
        sent.response.status,
        await sent.response.text()
      )
      return null
    }
    const { input_tokens } = (await sent.response.json()) as {
      input_tokens?: unknown
    }
    return typeof input_tokens === "number" ? input_tokens : null
  } catch (error) {
    console.warn("count_tokens failed", error)
    return null
  }
}

/**
 * Anthropic's own words for a prompt over the window, on purpose: the CLI
 * matches `prompt is too long: N tokens > M maximum` and answers it by
 * compacting the conversation and sending again, rather than failing the turn.
 */
export function promptTooLong(tokens: number, max: number): Response {
  return anthropicError(
    400,
    "invalid_request_error",
    `prompt is too long: ${tokens} tokens > ${max} maximum`
  )
}
