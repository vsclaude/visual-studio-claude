/**
 * The studio's own server (`vsclaude-cloud`) in main: where it is, and the
 * calls made to it — all about Vey Pro (`license.ts`): the page to pay on,
 * and the licence a payment bought, activated on this device.
 *
 * **No sign-in.** These calls carried a Google sign-in's access token, held
 * here and renewed on a timer, while Pro belonged to a Google account; that is
 * deleted (`docs/design.md` § Pro, sign-in removed). A licence is a key and
 * the device it is on, so what a call carries is this device's id, in its
 * body.
 *
 * Free of `electron`. Module state rather than a class threaded through:
 * `ipc.ts` is the one caller.
 */

import type { PurchaseResult } from "../shared/license"
import { normalizeServerUrl, STUDIO_SERVER_URL } from "../shared/studio-server"

/** The server, or null for none configured — which hides the purchase of
 * Pro. `VEYSTUDIO_BUILD_AI_URL` is no variable at runtime:
 * esbuild replaces it with the `VEYSTUDIO_AI_URL` the build saw
 * (`scripts/build-electron.mjs`). `VSCLAUDE_AI_URL` is that variable under
 * the app's old name. The variable names keep `AI` because they are already
 * set on the machines and the CI that build this app. */
export function serverUrl(): string | null {
  return normalizeServerUrl(
    process.env.VEYSTUDIO_AI_URL ||
      process.env.VSCLAUDE_AI_URL ||
      process.env.VEYSTUDIO_BUILD_AI_URL ||
      STUDIO_SERVER_URL
  )
}

/** A call's answer: its JSON, or why not — the server's own sentence where it
 * gave one, and its status, which is how a refunded key (410) is told from a
 * server that could not be reached (no status). */
export type ServerAnswer =
  { ok: true; json: unknown } | { ok: false; error: string; status?: number }

/**
 * A call to the server, answered as its JSON — or why not, in words the Pro
 * dialog can show. Main makes these rather than the renderer because main is
 * what knows the server (`VEYSTUDIO_AI_URL` is its environment's).
 */
export async function serverCall(
  method: "GET" | "POST",
  route: string,
  body?: unknown
): Promise<ServerAnswer> {
  const url = serverUrl()
  if (!url) {
    return { ok: false, error: "This build has no server to buy Pro from." }
  }
  let response: Response
  try {
    response = await fetch(`${url}${route}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { ok: false, error: "The studio's server could not be reached." }
  }
  if (response.status === 204) return { ok: true, json: null }
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const fields = json as {
      error?: string | { message?: string }
    } | null
    const error =
      typeof fields?.error === "string"
        ? fields.error
        : (fields?.error?.message ?? `The server answered ${response.status}.`)
    return { ok: false, error, status: response.status }
  }
  return { ok: true, json }
}

/**
 * A checkout's page from the server, handed to `open` — the browser. Only an
 * `https:` page is opened: it is a link the server chose, and nothing else
 * from there should reach `shell.openExternal`.
 */
export async function openServerPage(
  route: "/api/license/checkout",
  body: unknown,
  open: (url: string) => void
): Promise<PurchaseResult> {
  const answer = await serverCall("POST", route, body)
  if (!answer.ok) return answer
  const page = (answer.json as { url?: unknown } | null)?.url
  if (typeof page !== "string" || !isWebPage(page)) {
    return { ok: false, error: "The server answered without a page to open." }
  }
  open(page)
  return { ok: true }
}

function isWebPage(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    )
  } catch {
    return false
  }
}
