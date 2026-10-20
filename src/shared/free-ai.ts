/**
 * The free AI: chats run through this app's own server rather than an account
 * of the user's, for anybody signed in to the studio — on any of
 * `FREE_AI_MODELS`, paid for out of credits the user buys.
 *
 * It is an account in the composer's menu like a profile, but **not a
 * profile**: nothing in Settings names it, renames it or deletes it, and it is
 * there exactly while somebody is signed in. Its id is this constant on a
 * chat's `profileId`, and main resolves it to a `CLAUDE_CONFIG_DIR` of its own
 * (`main/free-ai.ts`).
 *
 * Pure and shared. `test/free-ai.ts`.
 */

export const FREE_PROFILE_ID = "vsclaude-free"

/**
 * The server the free AI's requests go to — empty until there is one, which
 * hides the free AI everywhere. `VSCLAUDE_AI_URL` in the environment main is
 * started with overrides it, for a server running on this machine.
 *
 * The server is sent the signed-in user's access token on every request,
 * as `Authorization: Bearer` and as `x-api-key` both (the CLI's own habit with
 * an `apiKeyHelper`), and is expected to verify it, refuse any model outside
 * `FREE_AI_MODELS`, and forward to Anthropic with a key of its own.
 */
export const FREE_AI_URL = ""

/**
 * The models the server runs, by alias — full ids, because they are what every
 * alias is pointed at (`freeAiEnv`). Keep in step with the server's
 * `NITRO_ALLOWED_MODELS`.
 */
export const FREE_AI_MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const

/** The largest prompt the server forwards — `maxPromptTokens` there. */
export const FREE_AI_MAX_PROMPT = 100_000

/**
 * `input` as a base URL, or null for something that is not one: `https`,
 * or `http` to this machine alone, since the user's token goes there on every
 * request. A trailing slash is dropped — the CLI appends `/v1/messages`.
 */
export function normalizeAiUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.username || url.password || url.search || url.hash) return null
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return null
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
}

/**
 * What a `claude` running on the free AI is handed, beside its
 * `CLAUDE_CONFIG_DIR` — whose `settings.json` names the `apiKeyHelper` that
 * reads the token (`apiKeyHelperCommand`).
 *
 * **Every alias is pointed at a model the server runs**, not left to the CLI's
 * own idea of what `opus` or `sonnet` means today: the CLI asks for models on
 * its own — a subagent, the default behind `Inherit` — and an id the server
 * does not serve would be a request refused halfway through a turn.
 *
 * **The user's own credentials are emptied**: a spawned `claude` gets the login
 * shell's whole env, and an `ANTHROPIC_API_KEY` exported there would win over
 * the helper and be sent to this app's server — somebody's key for Anthropic,
 * handed to a third party.
 *
 * The helper is re-run every five minutes, well inside the hour an access
 * token lives, so a session open all afternoon keeps sending a live one.
 *
 * **The conversation is compacted before 100K**, where the price goes up: the server refuses a longer prompt (in words the CLI compacts on),
 * but compacting at the CLI's own threshold costs one summary instead of a
 * refused request first. 100K is also the least the CLI accepts here.
 */
export function freeAiEnv(url: string): Record<string, string> {
  return {
    ANTHROPIC_BASE_URL: url,
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_AUTH_TOKEN: "",
    CLAUDE_CODE_OAUTH_TOKEN: "",
    CLAUDE_CODE_API_KEY_HELPER_TTL_MS: String(5 * 60_000),
    ANTHROPIC_DEFAULT_OPUS_MODEL: FREE_AI_MODELS.opus,
    ANTHROPIC_DEFAULT_SONNET_MODEL: FREE_AI_MODELS.sonnet,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: FREE_AI_MODELS.haiku,
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(FREE_AI_MAX_PROMPT),
  }
}

/**
 * The `apiKeyHelper` that prints the token file — `type` on Windows, where the
 * CLI runs it through `cmd.exe` (measured against a local server: the token
 * arrived), `cat` everywhere else.
 */
export function apiKeyHelperCommand(
  tokenFile: string,
  platform: string
): string {
  return platform === "win32"
    ? `type "${tokenFile}"`
    : `cat '${tokenFile.replaceAll("'", `'\\''`)}'`
}
