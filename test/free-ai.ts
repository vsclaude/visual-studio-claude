import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { ClaudeAccount } from "../src/shared/api"
import {
  apiKeyHelperCommand,
  FREE_AI_MAX_PROMPT,
  FREE_AI_MODELS,
  FREE_PROFILE_ID,
  freeAiEnv,
  normalizeAiUrl,
} from "../src/shared/free-ai"
import {
  accountEnv,
  freeAiReady,
  setFreeAiDir,
  setFreeAiToken,
} from "../src/main/free-ai"
import { newChatOptions } from "../src/renderer/lib/free-ai"
import { check, finish, section } from "./harness"

/**
 * The free AI — chats through this app's server, on any model it runs, for
 * whoever is signed in to the studio.
 *
 * Tested because what is at stake is where a token goes and what it is spent
 * on: the address check keeps it off plain `http` to another machine, the env
 * keeps the user's own Anthropic key from riding along, and the alias pinning
 * is what keeps a free turn from asking the server for a model it does not run. The token file is
 * written for real, the way the CLI will read it.
 */

section("normalizeAiUrl: what may become ANTHROPIC_BASE_URL")

check(
  "https, trailing slash dropped",
  normalizeAiUrl(" https://ai.example.com/ ") === "https://ai.example.com"
)
check(
  "a path prefix is kept",
  normalizeAiUrl("https://ai.example.com/v/") === "https://ai.example.com/v"
)
check(
  "http to this machine",
  normalizeAiUrl("http://localhost:4000") === "http://localhost:4000"
)
check(
  "http anywhere else is refused",
  normalizeAiUrl("http://ai.example.com") === null
)
check("empty is none", normalizeAiUrl("") === null)
check("a query is refused", normalizeAiUrl("https://a.example/?k=1") === null)

section("freeAiEnv: what the CLI is handed")

const env = freeAiEnv("https://ai.example.com")
check("the server", env.ANTHROPIC_BASE_URL === "https://ai.example.com", env)
check(
  "the user's own credentials are emptied",
  env.ANTHROPIC_API_KEY === "" &&
    env.ANTHROPIC_AUTH_TOKEN === "" &&
    env.CLAUDE_CODE_OAUTH_TOKEN === "",
  env
)
check(
  "every alias is a model the server runs, itself",
  env.ANTHROPIC_DEFAULT_OPUS_MODEL === FREE_AI_MODELS.opus &&
    env.ANTHROPIC_DEFAULT_SONNET_MODEL === FREE_AI_MODELS.sonnet &&
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL === FREE_AI_MODELS.haiku,
  env
)
check(
  "nothing pins the chat's own pick",
  !("ANTHROPIC_MODEL" in env) && !("CLAUDE_CODE_SUBAGENT_MODEL" in env),
  env
)
check(
  "the helper is re-run inside the token's hour",
  Number(env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS) < 60 * 60_000,
  env
)
check(
  "compacted before the server's ceiling",
  env.CLAUDE_CODE_AUTO_COMPACT_WINDOW === String(FREE_AI_MAX_PROMPT),
  env
)

section("apiKeyHelperCommand")

check(
  "type on Windows",
  apiKeyHelperCommand("C:\\a b\\t", "win32") === 'type "C:\\a b\\t"'
)
check(
  "cat elsewhere",
  apiKeyHelperCommand("/a b/t", "darwin") === "cat '/a b/t'"
)
check(
  "a quote in the path stays one word",
  apiKeyHelperCommand("/it's/t", "linux") === "cat '/it'\\''s/t'"
)

section("setFreeAiToken and accountEnv: the directory on disk")

const dir = await mkdtemp(path.join(tmpdir(), "vsclaude-free-"))
const previousUrl = process.env.VSCLAUDE_AI_URL
process.env.VSCLAUDE_AI_URL = "http://localhost:4000"
// The server's `POST /api/session`, stood in for: a session it knows is worth
// an access token, anything else is refused. `fetch` rather than a socket, so
// this runs where a port cannot be opened.
const realFetch = globalThis.fetch
const exchanged: string[] = []
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const bearer = new Headers(init?.headers).get("authorization") ?? ""
  exchanged.push(`${init?.method} ${url} ${bearer}`)
  return bearer === "Bearer session-1"
    ? Response.json({ token: "access-1", expiresAt: Date.now() + 3600_000 })
    : Response.json({ error: "Sign in again." }, { status: 401 })
}) as typeof fetch
try {
  setFreeAiDir(dir)
  await writeFile(
    path.join(dir, "settings.json"),
    JSON.stringify({ theme: "dark" })
  )

  check("not ready before a token", !freeAiReady())

  const ready = await setFreeAiToken("session-1")
  check("ready once handed a session", ready && freeAiReady())
  check(
    "the session is exchanged with the server",
    exchanged[0] === "POST http://localhost:4000/api/session Bearer session-1",
    exchanged
  )
  check(
    "the token file holds the access token, not the session",
    (await readFile(path.join(dir, "vsclaude-token"), "utf8")) === "access-1"
  )
  const settings = JSON.parse(
    await readFile(path.join(dir, "settings.json"), "utf8")
  ) as Record<string, unknown>
  check(
    "settings.json names the helper",
    typeof settings.apiKeyHelper === "string" &&
      settings.apiKeyHelper.includes("vsclaude-token"),
    settings
  )
  check("and keeps the CLI's own keys", settings.theme === "dark", settings)

  const free = accountEnv(dir)
  check(
    "the free directory brings its server",
    free.CLAUDE_CONFIG_DIR === dir &&
      free.ANTHROPIC_BASE_URL === "http://localhost:4000",
    free
  )
  const other = accountEnv("/profiles/work")
  check(
    "another profile is its directory alone",
    JSON.stringify(other) ===
      JSON.stringify({ CLAUDE_CONFIG_DIR: "/profiles/work" }),
    other
  )
  check(
    "the default login is nothing",
    Object.keys(accountEnv(null)).length === 0
  )

  await setFreeAiToken(null)
  check("signed out is not ready", !freeAiReady())
  const left = await readFile(path.join(dir, "vsclaude-token"), "utf8").catch(
    () => null
  )
  check("and the token file is gone", left === null)

  check(
    "a session the server refuses is not ready",
    !(await setFreeAiToken("session-2")) && !freeAiReady()
  )
  check(
    "and leaves no token behind",
    (await readFile(path.join(dir, "vsclaude-token"), "utf8").catch(
      () => null
    )) === null
  )
} finally {
  globalThis.fetch = realFetch
  if (previousUrl === undefined) delete process.env.VSCLAUDE_AI_URL
  else process.env.VSCLAUDE_AI_URL = previousUrl
  await rm(dir, { recursive: true, force: true })
}

section("newChatOptions: who opens on the free AI")

const signedOut: ClaudeAccount = {
  configDir: "",
  state: "signedOut",
  email: null,
  organization: null,
  method: null,
  plan: null,
  error: null,
}
const signedInLogin: ClaudeAccount = { ...signedOut, state: "signedIn" }

const opening = newChatOptions({ ready: true, login: signedOut, profiles: [] })
check(
  "no Claude login of their own: free, starting on Haiku",
  opening?.profileId === FREE_PROFILE_ID && opening.model === "haiku",
  opening
)
check(
  "a Claude login of their own: left alone",
  newChatOptions({ ready: true, login: signedInLogin, profiles: [] }) ===
    undefined
)
check(
  "profiles of their own: left alone",
  newChatOptions({
    ready: true,
    login: signedOut,
    profiles: [{ id: "p", name: "Work", configDir: "/p" }],
  }) === undefined
)
check(
  "a login not checked yet is not signed out",
  newChatOptions({ ready: true, login: undefined, profiles: [] }) === undefined
)
check(
  "not signed in to the studio: left alone",
  newChatOptions({ ready: false, login: signedOut, profiles: [] }) === undefined
)

finish()
