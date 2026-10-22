/**
 * The free AI's half in main: where its `CLAUDE_CONFIG_DIR` is, the token the
 * CLI sends, and what every `claude` started on a profile is handed.
 *
 * **The token is a file the CLI reads, not a variable it is given.** An
 * access token lives an hour and a chat session can stay open all day, so a
 * token fixed into a process's env at spawn is a session that starts failing
 * at minute sixty. Instead the directory's own `settings.json` names an
 * `apiKeyHelper` that prints `vsclaude-token`, the CLI re-runs it every five
 * minutes (`freeAiEnv`), and this renews the token from the session the
 * renderer hands over (`setFreeAiToken`). The directory is this app's, under
 * the workspace, so writing the CLI's settings file there is writing nobody's.
 *
 * Written `0600` and deleted on sign-out. It is not sealed by the keychain the
 * way a long-lived secret would be: the CLI has to read it with `cat`, and what
 * is in it stops working within the hour.
 *
 * Free of `electron`. Module state rather than a class threaded through: every
 * place that starts a `claude` already asks `accountEnv` by directory.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  apiKeyHelperCommand,
  FREE_AI_URL,
  freeAiEnv,
  normalizeAiUrl,
} from "../shared/free-ai"
import type { PurchaseResult, StudioAccount } from "../shared/credits"

const TOKEN_FILE = "vsclaude-token"

let freeDir: string | null = null
/** The access token this run was given — a file left by an earlier run is not
 * one, since nobody has said that user is still signed in. */
let token: string | null = null

/** Called once by `ipc.ts`, with the workspace's own directory for it. */
export function setFreeAiDir(dir: string): void {
  freeDir = dir
}

export function freeAiDir(): string | null {
  return freeDir
}

/** The server, or null for none configured — which hides the free AI.
 * `VSCLAUDE_BUILD_AI_URL` is no variable at runtime: esbuild replaces it with
 * the `VSCLAUDE_AI_URL` the build saw (`scripts/build-electron.mjs`). */
export function freeAiUrl(): string | null {
  return normalizeAiUrl(
    process.env.VSCLAUDE_AI_URL ||
      process.env.VSCLAUDE_BUILD_AI_URL ||
      FREE_AI_URL
  )
}

/** Whether a turn on the free AI can run right now. */
export function freeAiReady(): boolean {
  return token !== null && freeAiUrl() !== null && freeDir !== null
}

/** How long before an access token lapses it is replaced — twice the CLI's
 * five-minute cache of the helper's output, so it never sends a dead one. */
const RENEW_AHEAD_MS = 10 * 60_000

/** Between attempts when the server could not be reached. */
const RETRY_MS = 60_000

/**
 * The signed-in user's session token, or null on sign-out.
 *
 * The session is not what the CLI is given: it lives ninety days, and the
 * file the CLI reads is plain. It is exchanged with the server
 * (`POST /api/session`) for an hour's access token, which is what is written,
 * and exchanged again ten minutes before that hour is up — here, by a timer,
 * the way Firebase used to refresh its token in the renderer.
 *
 * A session the server refuses is a sign-in that is over (the user removed,
 * the secret changed): the token goes and the free AI with it. A server that
 * cannot be reached is a moment offline, and the current token stays while
 * it is asked again.
 */
export async function setFreeAiToken(next: string | null): Promise<boolean> {
  clearTimeout(renewal)
  session = next
  if (!next) {
    await writeToken(null)
    return false
  }
  return renew(next)
}

let session: string | null = null
let renewal: ReturnType<typeof setTimeout> | undefined

async function renew(held: string): Promise<boolean> {
  const answer = await exchangeSession(held)
  // Signed out, or in as somebody else, while the server was asked.
  if (session !== held) return freeAiReady()
  if (answer.kind === "refused") {
    console.warn(`[free-ai] the session was refused: ${answer.reason}`)
    await writeToken(null)
    return false
  }
  if (answer.kind === "token") await writeToken(answer.token)
  const wait =
    answer.kind === "token"
      ? Math.max(answer.expiresAt - Date.now() - RENEW_AHEAD_MS, RETRY_MS)
      : RETRY_MS
  renewal = setTimeout(() => void renew(held), wait)
  return freeAiReady()
}

type Exchanged =
  | { kind: "token"; token: string; expiresAt: number }
  | { kind: "refused"; reason: string }
  | { kind: "offline" }

async function exchangeSession(held: string): Promise<Exchanged> {
  const url = freeAiUrl()
  if (!url) return { kind: "refused", reason: "no server" }
  let response: Response
  try {
    response = await fetch(`${url}/api/session`, {
      method: "POST",
      headers: { authorization: `Bearer ${held}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { kind: "offline" }
  }
  const json = (await response.json().catch(() => null)) as {
    token?: unknown
    expiresAt?: unknown
    error?: unknown
  } | null
  if (response.status === 401) {
    return { kind: "refused", reason: String(json?.error ?? "401") }
  }
  if (
    !response.ok ||
    typeof json?.token !== "string" ||
    typeof json.expiresAt !== "number"
  ) {
    return { kind: "offline" }
  }
  return { kind: "token", token: json.token, expiresAt: json.expiresAt }
}

/**
 * The access token the CLI's `apiKeyHelper` prints, or null to remove it.
 *
 * `settings.json` is merged rather than written whole: the CLI keeps its own
 * keys in the same file, and this only owns `apiKeyHelper`.
 */
async function writeToken(next: string | null): Promise<void> {
  const dir = freeDir
  if (!dir) return
  const file = path.join(dir, TOKEN_FILE)

  if (!next) {
    token = null
    await rm(file, { force: true })
    return
  }

  await mkdir(dir, { recursive: true })
  await writeFile(file, next, { encoding: "utf8", mode: 0o600 })

  const settingsFile = path.join(dir, "settings.json")
  let settings: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(await readFile(settingsFile, "utf8"))
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      settings = parsed as Record<string, unknown>
    }
  } catch {
    // Missing or unreadable — it is about to be this app's anyway.
  }
  const helper = apiKeyHelperCommand(file, process.platform)
  if (settings.apiKeyHelper !== helper) {
    await writeFile(
      settingsFile,
      JSON.stringify({ ...settings, apiKeyHelper: helper }, null, 2),
      "utf8"
    )
  }

  token = next
}

/**
 * A call to the free AI's server as the signed-in user, answered as its JSON —
 * or why not, in words the credits dialog can show. Main makes these rather
 * than the renderer because main is what knows the server (`VSCLAUDE_AI_URL`
 * is its environment's) and already holds the token.
 */
async function serverCall(
  method: "GET" | "POST",
  route: string,
  body?: unknown
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const url = freeAiUrl()
  if (!url || !token) {
    return { ok: false, error: "Sign in to VS Claude first." }
  }
  let response: Response
  try {
    response = await fetch(`${url}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { ok: false, error: "The studio's server could not be reached." }
  }
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    // The server's own `{ error }`, or Anthropic's shape for a sign-in refusal.
    const fields = json as {
      error?: string | { message?: string }
    } | null
    const error =
      typeof fields?.error === "string"
        ? fields.error
        : (fields?.error?.message ?? `The server answered ${response.status}.`)
    return { ok: false, error }
  }
  return { ok: true, json }
}

/** The user's day and credits, or null when there is none to ask. */
export async function studioAccount(): Promise<StudioAccount | null> {
  const answer = await serverCall("GET", "/api/usage")
  if (!answer.ok || !answer.json || typeof answer.json !== "object") {
    return null
  }
  const account = answer.json as StudioAccount
  // A server from before `creditsUsed` leaves it out; the dialog draws a sum.
  return { ...account, creditsUsed: Number(account.creditsUsed) || 0 }
}

/**
 * A checkout's page from the server, handed to `open` — the
 * browser. Only an `https:` page is opened: it is a link the server chose,
 * and nothing else from there should reach `shell.openExternal`.
 */
export async function openServerPage(
  route: "/api/checkout" | "/api/orders",
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

/**
 * `CLAUDE_CONFIG_DIR` for a profile's directory, plus the free AI's server and
 * models when it is that one — nothing at all for the default login.
 *
 * What every `claude` started on a profile is handed in place of building
 * `{ CLAUDE_CONFIG_DIR }` itself: a chat's session, a rewind, the commit draft
 * and the usage meter.
 */
export function accountEnv(configDir: string | null): Record<string, string> {
  if (!configDir) return {}
  const url = freeAiUrl()
  return {
    CLAUDE_CONFIG_DIR: configDir,
    ...(url && configDir === freeDir ? freeAiEnv(url) : {}),
  }
}
