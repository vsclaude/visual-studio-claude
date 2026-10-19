import { defineHandler } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import {
  allowedModel,
  anthropicError,
  downstreamHeaders,
  upstreamHeaders,
} from "../../../utils/anthropic.ts"
import { authenticate } from "../../../utils/auth.ts"
import { limitsOf } from "../../../utils/limits.ts"
import { noteRequest } from "../../../utils/log.ts"

/**
 * `POST /v1/messages/count_tokens` — how big a prompt is, which the CLI asks
 * before compacting. Free at Anthropic, so it is not charged to credits,
 * but it is still a signed-in user's and still the allowed model's.
 */
export default defineHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.anthropicApiKey) {
    return anthropicError(500, "api_error", "The server has no Anthropic key.")
  }

  const user = await authenticate(event)
  if (user instanceof Response) return user

  const text = await event.req.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return anthropicError(400, "invalid_request_error", "The body is not JSON.")
  }
  const { models } = await limitsOf(user.uid)
  if (!allowedModel(body, models)) {
    noteRequest(event, { refused: "model not allowed" })
    return anthropicError(
      400,
      "invalid_request_error",
      `This server runs ${models.join(", ")} only.`
    )
  }

  const url = new URL(
    event.url.pathname + event.url.search,
    config.anthropicBaseUrl
  )
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: upstreamHeaders(event.req.headers, config.anthropicApiKey),
      body: text,
      signal: event.req.signal,
    })
    const answer = await upstream.text()
    if (!upstream.ok) {
      noteRequest(event, { upstream_error: answer.slice(0, 300) })
    }
    // As in `index.post.ts`: Anthropic refusing this server's key is the
    // server's fault, and a 401 would have the CLI retry for minutes.
    if (upstream.status === 401 || upstream.status === 403) {
      return anthropicError(
        500,
        "api_error",
        "The free AI's server is misconfigured: Anthropic refused its API key."
      )
    }
    return new Response(answer, {
      status: upstream.status,
      headers: downstreamHeaders(upstream.headers),
    })
  } catch (error) {
    noteRequest(event, {
      refused: "Anthropic unreachable",
      error: String(error),
    })
    return anthropicError(502, "api_error", "Anthropic could not be reached.")
  }
})
