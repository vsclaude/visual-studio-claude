import type { H3Event } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import { anthropicError } from "./anthropic.ts"
import { noteRequest } from "./log.ts"
import { tokenOf, verifyAccess, type User } from "./session.ts"

/**
 * The signed-in studio user a request is from, or the refusal to answer with.
 *
 * **A 400, not Anthropic's 401.** Measured against the CLI: a 401 (or 403) is
 * read as a credential to refresh, so it re-runs the `apiKeyHelper` and tries
 * again ten times with backoff — two and a half minutes of a chat saying
 * "working" over a token that will not get better, `x-should-retry: false`
 * notwithstanding. A 400 is shown at once, with the message below, which is
 * the point of the message.
 */
export async function authenticate(event: H3Event): Promise<User | Response> {
  const token = tokenOf(event.req.headers)
  if (!token) {
    noteRequest(event, { refused: "no token" })
    return anthropicError(
      400,
      "authentication_error",
      "Sign in to VS Claude to use the free AI."
    )
  }
  const verified = await verifyAccess(
    token,
    String(useRuntimeConfig().sessionSecret)
  )
  if (!verified.ok) {
    noteRequest(event, { refused: verified.reason })
    return anthropicError(
      400,
      "authentication_error",
      `VS Claude could not verify your sign-in: ${verified.reason}. Sign out and in again if it persists.`
    )
  }
  noteRequest(event, { uid: verified.user.uid })
  return verified.user
}
