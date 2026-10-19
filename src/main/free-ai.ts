/**
 * The free AI's half in main: where its `CLAUDE_CONFIG_DIR` is, the token the
 * CLI sends, and what every `claude` started on a profile is handed.
 *
 * **The token is a file the CLI reads, not a variable it is given.** A
 * Firebase ID token lives an hour and a chat session can stay open all day, so
 * a token fixed into a process's env at spawn is a session that starts failing
 * at minute sixty. Instead the directory's own `settings.json` names an
 * `apiKeyHelper` that prints `vsclaude-token`, the CLI re-runs it every five
 * minutes (`freeAiEnv`), and the renderer hands over each token Firebase
 * refreshes (`setFreeAiToken`). The directory is this app's, under the
 * workspace, so writing the CLI's settings file there is writing nobody's.
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
/** The token this run was handed — a file left by an earlier run is not one,
 * since nobody has said that user is still signed in. */
let token: string | null = null

/** Called once by `ipc.ts`, with the workspace's own directory for it. */
export function setFreeAiDir(dir: string): void {
  freeDir = dir
}

export function freeAiDir(): string | null {
  return freeDir
}

/** The server, or null for none configured — which hides the free AI. */
export function freeAiUrl(): string | null {
  return normalizeAiUrl(process.env.VSCLAUDE_AI_URL || FREE_AI_URL)
}

/** Whether a turn on the free AI can run right now. */
export function freeAiReady(): boolean {
  return token !== null && freeAiUrl() !== null && freeDir !== null
}

/**
 * The signed-in user's current Firebase ID token, or null on sign-out.
 *
 * `settings.json` is merged rather than written whole: the CLI keeps its own
 * keys in the same file, and this only owns `apiKeyHelper`.
 */
export async function setFreeAiToken(next: string | null): Promise<boolean> {
  const dir = freeDir
  if (!dir) return false
  const file = path.join(dir, TOKEN_FILE)

  if (!next) {
    token = null
    await rm(file, { force: true })
    return false
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
  return freeAiReady()
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
    return { ok: false, error: "Sign in to Visual Studio Claude first." }
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
