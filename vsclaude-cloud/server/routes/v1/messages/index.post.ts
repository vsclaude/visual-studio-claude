import { defineHandler } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import {
  allowedModel,
  anthropicError,
  countTokens,
  downstreamHeaders,
  mayExceed,
  promptTooLong,
  upstreamHeaders,
} from "../../../utils/anthropic.ts"
import { chargeCredits } from "../../../utils/accounts.ts"
import { authenticate } from "../../../utils/auth.ts"
import { limitsOf } from "../../../utils/limits.ts"
import { logLine, noteRequest } from "../../../utils/log.ts"
import {
  StreamUsage,
  usageOf,
  weighted,
  type Usage,
} from "../../../utils/usage.ts"

/**
 * `POST /v1/messages` — the one call a chat makes, passed through to Anthropic
 * for a signed-in user with credits, on any of the server's models, and paid
 * for out of those credits (`limits.ts`, `billing.ts`).
 *
 * The body goes on **as the bytes that arrived**: it is parsed only to read the
 * model, and re-serialising it could reorder what the CLI wrote and spoil the
 * prompt cache's prefix match. The answer comes back the same way, streamed
 * chunk for chunk, with a reader alongside that keeps the usage.
 *
 * A prompt over `maxPromptTokens` is refused before it costs anything, in the
 * words that make the CLI compact and retry (`promptTooLong`). The studio sets
 * the CLI's own compact window to the same 100K, so this is the backstop.
 */
export default defineHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.anthropicApiKey) {
    noteRequest(event, { refused: "no Anthropic key configured" })
    return anthropicError(500, "api_error", "The server has no Anthropic key.")
  }

  const user = await authenticate(event)
  if (user instanceof Response) return user

  const text = await event.req.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    noteRequest(event, { refused: "body is not JSON" })
    return anthropicError(400, "invalid_request_error", "The body is not JSON.")
  }

  const model = (body as { model?: unknown }).model
  noteRequest(event, {
    model: typeof model === "string" ? model : undefined,
    bytes: text.length,
  })
  const { models, account } = await limitsOf(user.uid)
  const allowed = allowedModel(body, models)
  if (!allowed) {
    noteRequest(event, { refused: "model not allowed" })
    // 400 rather than 403 for the reason `authenticate` gives: the CLI retries
    // a 403 for minutes.
    return anthropicError(
      400,
      "invalid_request_error",
      `This server runs ${models.join(", ")} only.`
    )
  }

  // Every request is paid for out of credits, so none left is a refusal before
  // anything is spent. 400 for the reason above, and because no reset is
  // coming for a `retry-after` to name. A request that starts with a little
  // left is finished and the balance stops at 0 (`chargeCredits`) — the
  // overdraft is one request, never more.
  if (account.credits <= 0) {
    noteRequest(event, { refused: "no credits" })
    return anthropicError(
      400,
      "invalid_request_error",
      "You have no credits left. Buy credits from the account menu in Visual Studio Claude to keep going."
    )
  }

  const maxPrompt = Number(config.maxPromptTokens)
  if (maxPrompt > 0 && mayExceed(text, maxPrompt)) {
    const tokens = await countTokens(body as Record<string, unknown>, {
      baseUrl: config.anthropicBaseUrl,
      search: event.url.search,
      headers: upstreamHeaders(event.req.headers, config.anthropicApiKey),
      signal: event.req.signal,
    })
    noteRequest(event, { prompt_tokens: tokens ?? "uncounted" })
    if (tokens !== null && tokens > maxPrompt) {
      noteRequest(event, { refused: "prompt too long" })
      return promptTooLong(tokens, maxPrompt)
    }
  }

  const url = new URL(
    event.url.pathname + event.url.search,
    config.anthropicBaseUrl
  )
  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: upstreamHeaders(event.req.headers, config.anthropicApiKey),
      body: text,
      // A chat the user stopped is a request Anthropic should stop generating.
      signal: event.req.signal,
    })
  } catch (error) {
    if (event.req.signal.aborted) {
      noteRequest(event, { refused: "client went away" })
      return new Response(null, { status: 499 })
    }
    noteRequest(event, {
      refused: "Anthropic unreachable",
      error: String(error),
    })
    return anthropicError(502, "api_error", "Anthropic could not be reached.")
  }

  const headers = downstreamHeaders(upstream.headers)
  const rid = upstream.headers.get("request-id") ?? undefined
  noteRequest(event, { rid, upstream_status: upstream.status })
  // What a request cost, once it is known: on the request's own line when the
  // answer was read whole, on a line of its own when it streamed.
  const spend = async (usage: Usage, ended?: string) => {
    const amount = weighted(usage, allowed)
    await chargeCredits(user.uid, amount)
    return {
      credits_charged: amount || undefined,
      in: usage.input_tokens,
      out: usage.output_tokens,
      cache_read: usage.cache_read_input_tokens,
      cache_write: usage.cache_creation_input_tokens,
      weighted: amount,
      ended,
    }
  }
  const streamed = upstream.headers
    .get("content-type")
    ?.includes("text/event-stream")

  if (!upstream.body || !upstream.ok || !streamed) {
    // Errors and non-streamed answers are small: read whole, counted from the
    // JSON's own `usage` when there is one, and passed on unchanged.
    const answer = await upstream.text()
    if (upstream.ok) {
      try {
        const parsed = JSON.parse(answer) as { usage?: unknown }
        noteRequest(event, await spend(usageOf(parsed.usage)))
      } catch {
        // Not JSON: nothing to count, and the client is owed it anyway.
      }
    } else {
      // Anthropic's own refusal, passed on unchanged — and worth seeing here,
      // since the CLI shows it to the user and not to whoever runs this.
      noteRequest(event, { upstream_error: answer.slice(0, 300) })
      if (upstream.status === 401 || upstream.status === 403) {
        // Anthropic refusing this server's key is not the user's credential
        // failing, and passed on as a 401 it would have the CLI re-run its
        // helper and retry for minutes. It is the server's fault: say so.
        return anthropicError(
          500,
          "api_error",
          "The free AI's server is misconfigured: Anthropic refused its API key."
        )
      }
    }
    return new Response(answer, { status: upstream.status, headers })
  }

  const meter = new StreamUsage()
  const reader = upstream.body.getReader()
  let recorded = false
  // Once, however the stream ends — finished, failed, or cut off by a Stop:
  // tokens Anthropic generated before the Stop were still paid for.
  const record = (ended: string) => {
    if (recorded) return
    recorded = true
    void spend(meter.usage, ended)
      .then((fields) => logLine("usage", { uid: user.uid, rid, ...fields }))
      .catch((error: unknown) =>
        logLine("usage", { uid: user.uid, rid, error: String(error) })
      )
  }

  const counted = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          record("done")
          controller.close()
          return
        }
        meter.push(value)
        controller.enqueue(value)
      } catch (error) {
        record("failed")
        controller.error(error)
      }
    },
    cancel(reason) {
      record("stopped")
      return reader.cancel(reason)
    },
  })

  return new Response(counted, { status: upstream.status, headers })
})
