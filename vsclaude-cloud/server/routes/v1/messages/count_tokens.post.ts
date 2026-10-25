import { defineHandler } from "nitro"

import {
  anthropicError,
  downstreamHeaders,
  requestedModel,
} from "../../../utils/anthropic.ts"
import { authenticate } from "../../../utils/auth.ts"
import { noteRequest } from "../../../utils/log.ts"
import { currentUpstreams } from "../../../utils/upstream-store.ts"
import { send } from "../../../utils/upstreams.ts"

/**
 * `POST /v1/messages/count_tokens` — how big a prompt is, which the CLI asks
 * before compacting. Free at Anthropic, so it is not charged to credits,
 * but it is still a signed-in user's. Down the same providers as a message
 * (`upstreams.ts`); one that serves no `count_tokens` answers 404, which is a
 * reason to ask the next.
 */
export default defineHandler(async (event) => {
  const upstreams = await currentUpstreams()
  if (upstreams.length === 0) {
    return anthropicError(500, "api_error", "The server has no API key.")
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
  if (!requestedModel(body)) {
    noteRequest(event, { refused: "no model" })
    return anthropicError(
      400,
      "invalid_request_error",
      "The request names no model."
    )
  }

  const sent = await send(upstreams, {
    path: event.url.pathname + event.url.search,
    headers: event.req.headers,
    body: text,
    signal: event.req.signal,
  })
  if (sent.kind === "aborted") return new Response(null, { status: 499 })
  if (sent.kind === "unreachable") {
    noteRequest(event, {
      refused: "no upstream reachable",
      tried: sent.tried.join(","),
    })
    return anthropicError(502, "api_error", "No provider could be reached.")
  }

  const upstream = sent.response
  const answer = await upstream.text()
  noteRequest(event, { upstream: sent.upstream.name })
  if (!upstream.ok) {
    noteRequest(event, { upstream_error: answer.slice(0, 300) })
  }
  // As in `index.post.ts`: the providers refusing this server's keys is the
  // server's fault, and a 401 would have the CLI retry for minutes.
  if (upstream.status === 401 || upstream.status === 403) {
    return anthropicError(
      500,
      "api_error",
      "The free AI's server is misconfigured: its providers refused their API keys."
    )
  }
  return new Response(answer, {
    status: upstream.status,
    headers: downstreamHeaders(upstream.headers),
  })
})
