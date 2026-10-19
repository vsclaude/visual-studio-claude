import { randomBytes } from "node:crypto"

import { SIGN_IN_CANCELLED } from "../shared/firebase"

/**
 * Google sign-in for a desktop window, which cannot run Google's own flow.
 *
 * Firebase's popup needs an origin on the project's authorized domains, and the
 * built renderer is `app://studio`, which is not one. Google also refuses
 * OAuth from an embedded browser, so the flow cannot run in a window of this
 * app at all. Instead the user's own browser opens `/signin/<nonce>` on the
 * free AI's server (`vsclaude-cloud`), that page runs the ordinary popup and
 * leaves the Google ID token with the server, and this asks the server for it
 * until it is there.
 *
 * It used to be a server of this app's own on `localhost`, one per attempt,
 * which the page posted back to. That is gone: a port opened on the user's
 * machine for every sign-in, and a page that could only change with a
 * release. `docs/design.md` § Signing in has the argument.
 *
 * Free of `electron` — the browser is opened through a callback — so
 * `test/google-sign-in.ts` can run the exchange against a stand-in server.
 */

/** How long the browser may take. Long enough to pick an account and read a
 * consent screen; the server keeps an answer for as long. */
const TIMEOUT_MS = 5 * 60_000

/** Between asks. A second or so is as soon as anybody notices, and over five
 * minutes it is a few hundred requests at most. */
const POLL_MS = 1_500

/** The attempt in progress, if any. A second press of the button ends the
 * first, rather than leaving two loops asking for two answers. */
let pending: ((outcome: string | Error) => void) | null = null

/**
 * Signs in with Google through the user's browser and resolves with the Google
 * ID token the renderer hands to Firebase.
 *
 * `server` is the free AI's base URL (`freeAiUrl`); `openUrl` is how the
 * browser is opened — the main process's `shell`, passed in so this module
 * does not import it.
 */
export function signInWithGoogle(
  server: string,
  openUrl: (url: string) => void,
  {
    fetch = globalThis.fetch,
    pollMs = POLL_MS,
  }: {
    /** `host.fetch` in the app — Chromium's stack, see `Host`. Node's own in
     * a test, against a stand-in server on loopback. */
    fetch?: (url: string, init?: RequestInit) => Promise<Response>
    pollMs?: number
  } = {}
): Promise<string> {
  pending?.(new Error("Sign-in was started again before this one finished."))

  return new Promise<string>((resolve, reject) => {
    // The only thing that ties the page's answer to this attempt: whoever
    // knows it can read the token, so it is never written anywhere but the
    // URL the browser is sent to.
    const nonce = randomBytes(24).toString("base64url")
    const answerUrl = `${server}/api/signin/${nonce}`
    const abort = new AbortController()
    let done = false
    let poll: ReturnType<typeof setTimeout> | undefined
    /** Why the last ask got no answer, when it was not simply "not yet" —
     * an attempt that cannot reach the server would otherwise wait out its
     * whole timeout saying nothing. */
    let trouble: string | null = null

    const timer = setTimeout(
      () =>
        finish(
          new Error(
            trouble
              ? `Sign-in could not reach the server: ${trouble}`
              : "Sign-in timed out in the browser."
          )
        ),
      TIMEOUT_MS
    )

    /** Logged once per distinct reason, not once per ask. */
    function note(reason: string): void {
      if (reason !== trouble) {
        console.warn(`[google-sign-in] asking ${server}: ${reason}`)
      }
      trouble = reason
    }

    /** Ends the attempt once, whichever way it ends first. */
    function finish(outcome: string | Error): void {
      if (done) return
      done = true
      clearTimeout(timer)
      clearTimeout(poll)
      abort.abort()
      if (pending === finish) pending = null
      if (outcome instanceof Error) reject(outcome)
      else resolve(outcome)
    }
    pending = finish

    async function ask(): Promise<void> {
      let answer: ReturnType<typeof parseAnswer> = null
      try {
        // No `cache` option: `net.fetch` would answer a repeat from Chromium's
        // HTTP cache, and the server's `no-store` already rules that out.
        const response = await fetch(answerUrl, { signal: abort.signal })
        if (response.status === 200) {
          const body = await response.text()
          answer = parseAnswer(body)
          if (!answer) note(`an answer that is not one: ${body.slice(0, 120)}`)
        } else if (response.status !== 204) {
          note(`HTTP ${response.status}`)
        }
      } catch (error) {
        // Offline for a moment, or the attempt just ended: the next ask, or
        // the timeout, settles it.
        if (!done) note(describe(error))
      }
      if (done) return
      if (answer) {
        finish(
          "idToken" in answer
            ? answer.idToken
            : new Error(answer.error ?? "Google returned no sign-in.")
        )
        return
      }
      poll = setTimeout(() => void ask(), pollMs)
    }

    openUrl(`${server}/signin/${nonce}`)
    poll = setTimeout(() => void ask(), pollMs)
  })
}

/**
 * Ends the attempt in progress as cancelled. For a browser tab that was closed
 * before it answered: the attempt would otherwise ask out its whole timeout
 * with the button locked. A no-op when there is no attempt.
 */
export function cancelSignInWithGoogle(): void {
  pending?.(new Error(SIGN_IN_CANCELLED))
}

/** A failed `fetch` in words — Node's own message is only "fetch failed",
 * and the reason (DNS, TLS, a refused connection) is on its `cause`. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause instanceof Error ? error.cause.message : null
  return cause ? `${error.message} (${cause})` : error.message
}

/** What the server hands back: a token, or the reason there is none. Anything
 * else is not an answer and is refused. */
export function parseAnswer(
  body: string
): { idToken: string } | { error?: string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const { idToken, error } = parsed as Record<string, unknown>
  if (typeof idToken === "string" && idToken.length > 0) return { idToken }
  if (idToken === undefined) {
    return typeof error === "string" ? { error } : {}
  }
  return null
}
