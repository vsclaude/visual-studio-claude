import { definePlugin } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import { logLine, notesOf } from "../utils/log.ts"

/**
 * The request log: one line per request when its response is made, with
 * whatever the handler noted (`noteRequest`). A streamed answer's line is
 * written when the stream starts, so its usage comes later as a `usage` line
 * of its own (`index.post.ts`), joined to this one by `rid`.
 *
 * And one line at start-up saying how the server is configured — whether a key
 * is set, never the key — since "no key" is the first thing to rule out.
 */
export default definePlugin((nitroApp) => {
  const config = useRuntimeConfig()
  logLine("start", {
    anthropic_key: config.anthropicApiKey ? "set" : "MISSING",
    upstream: config.anthropicBaseUrl,
    firebase_project: config.firebaseProjectId,
    models: config.allowedModels,
    max_prompt_tokens: config.maxPromptTokens,
  })

  const started = new WeakMap<object, number>()
  nitroApp.hooks.hook("request", (event) => {
    started.set(event, performance.now())
  })
  nitroApp.hooks.hook("response", (res, event) => {
    const since = started.get(event)
    const url = new URL(event.req.url)
    logLine("request", {
      method: event.req.method,
      path: url.pathname,
      status: res.status,
      ms:
        since === undefined ? undefined : Math.round(performance.now() - since),
      ...notesOf(event),
    })
  })
})
