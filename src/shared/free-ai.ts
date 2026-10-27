/**
 * The free AI: chats run through this app's own server rather than an account
 * of the user's, for anybody signed in to the studio — on DeepSeek's models
 * (`FREE_AI_MODELS`), paid for out of credits the user buys. The `claude` is
 * still the user's own; only what answers it is DeepSeek.
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
 * hides the free AI everywhere. `VEYSTUDIO_AI_URL` in the environment main is
 * started with overrides it, for a server running on this machine.
 *
 * The server is sent the signed-in user's access token on every request,
 * as `Authorization: Bearer` and as `x-api-key` both (the CLI's own habit with
 * an `apiKeyHelper`), and is expected to verify it and forward to DeepSeek's
 * Anthropic-compatible API with a key of its own, on whichever model the
 * request names.
 */
export const FREE_AI_URL = ""

/**
 * The models the server runs, by the CLI's alias each is put behind — full
 * ids, because they are what every alias is pointed at (`freeAiEnv`). Keep in
 * step with the server's `MODELS` (`limits.ts` there) and its prices
 * (`usage.ts`). DeepSeek has two models for the CLI's four aliases, so the
 * picker drops the repeats (`distinctModels` in `main/agent-models.ts`).
 */
export const FREE_AI_MODELS = {
  haiku: "deepseek-flash",
  sonnet: "deepseek-flash",
  opus: "deepseek-v4-pro",
  fable: "deepseek-v4-pro",
} as const

/** What `Default` is: Flash, the cheap one. Left to the CLI it is `opus[1m]`,
 * four times the price for somebody who never opened the picker. Handed over
 * as `ANTHROPIC_DEFAULT_MODEL`, which moves `Default` alone — measured — where
 * `ANTHROPIC_MODEL` would pin every chat whatever it picked. */
export const FREE_AI_DEFAULT_MODEL = FREE_AI_MODELS.sonnet

/** What the picker calls each, through the CLI's `_NAME` / `_DESCRIPTION`
 * variables — its own words would be `Opus` for a model that is not one. */
const FREE_AI_MODEL_NAMES: Record<
  keyof typeof FREE_AI_MODELS,
  readonly [string, string]
> = {
  haiku: ["DeepSeek Flash", "Quick tasks"],
  sonnet: ["DeepSeek Flash", "Fast and inexpensive"],
  opus: ["DeepSeek V4 Pro", "Stronger reasoning, about four times the price"],
  fable: ["DeepSeek V4 Pro", "Stronger reasoning, about four times the price"],
}

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
 * its own — a subagent, the default behind `Inherit` — and a `claude-*` id
 * would be answered by whichever model DeepSeek maps it to, under a name the
 * chat's usage line would draw as Claude.
 *
 * **The user's own credentials are emptied**: a spawned `claude` gets the login
 * shell's whole env, and an `ANTHROPIC_API_KEY` exported there would win over
 * the helper and be sent to this app's server — somebody's key for Anthropic,
 * handed to a third party.
 *
 * The helper is re-run every five minutes, well inside the hour an access
 * token lives, so a session open all afternoon keeps sending a live one.
 *
 * **The conversation is compacted before 100K.** DeepSeek has a 1M window
 * and no long-prompt price, but every request of a chat re-sends its whole
 * prompt, so a chat left to grow costs more per turn the longer it runs. The
 * server refuses a longer prompt (in words the CLI compacts on), but
 * compacting at the CLI's own threshold costs one summary instead of a refused
 * request first. 100K is also the least the CLI accepts here.
 */
export function freeAiEnv(url: string): Record<string, string> {
  const aliases = Object.entries(FREE_AI_MODELS).flatMap(([alias, model]) => {
    const prefix = `ANTHROPIC_DEFAULT_${alias.toUpperCase()}_MODEL`
    const [name, description] =
      FREE_AI_MODEL_NAMES[alias as keyof typeof FREE_AI_MODELS]
    return [
      [prefix, model],
      [`${prefix}_NAME`, name],
      [`${prefix}_DESCRIPTION`, description],
    ]
  })
  return {
    ANTHROPIC_BASE_URL: url,
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_AUTH_TOKEN: "",
    CLAUDE_CODE_OAUTH_TOKEN: "",
    CLAUDE_CODE_API_KEY_HELPER_TTL_MS: String(5 * 60_000),
    ...Object.fromEntries(aliases),
    ANTHROPIC_DEFAULT_MODEL: FREE_AI_DEFAULT_MODEL,
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
