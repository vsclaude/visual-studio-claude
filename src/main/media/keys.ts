import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  MEDIA_PROVIDERS,
  type MediaKeyStatus,
  type MediaProvider,
} from "../../shared/media"

/** Under `workspace/`, beside the rest of the panels' files. */
export const MEDIA_KEYS_FILE = "media-keys.json"

/**
 * What seals a key — Electron's `safeStorage` in the app, which is the OS
 * keychain's own key. An argument rather than an import so this stays free of
 * `electron` and `test/media-keys.ts` can hand in a fake.
 */
export type Sealer = {
  /** False where the OS has no keychain to seal with. */
  available: () => boolean
  seal: (text: string) => Uint8Array
  unseal: (bytes: Uint8Array) => string
}

/**
 * The media services' API keys, sealed at rest.
 *
 * **Sealed, not merely kept**: a key here spends somebody's money with no
 * prompt in between, and `~/.veystudio` is a directory backups, dotfile repos
 * and support zips all sweep up. So the file holds what the keychain sealed,
 * as base64, and a machine without a keychain is refused a key rather than
 * given one in the clear — the deleted Database panel's `encryption.ts` made
 * the same call for passwords.
 *
 * Read per call rather than held: a key is replaced in Settings while chats
 * are open, and the tool call after that should spend the new one. The file is
 * a few hundred bytes.
 */
export class MediaKeys {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly file: string,
    private readonly sealer: Sealer
  ) {}

  async status(): Promise<MediaKeyStatus> {
    const sealed = await this.read()
    const keys = Object.fromEntries(
      MEDIA_PROVIDERS.map((provider) => [provider, Boolean(sealed[provider])])
    ) as Record<MediaProvider, boolean>
    return { keys, sealable: this.sealer.available() }
  }

  /** The services with a key, in `MEDIA_PROVIDERS` order — which is what a
   * chat's session signature is made of, so the order must not wander. */
  async providers(): Promise<MediaProvider[]> {
    const sealed = await this.read()
    return MEDIA_PROVIDERS.filter((provider) => Boolean(sealed[provider]))
  }

  /** The key itself, for the tool call about to spend it. Null for none, and
   * for one the keychain will no longer open — a profile restored onto
   * another machine — which reads as "set it again" rather than a crash. */
  async keyOf(provider: MediaProvider): Promise<string | null> {
    const sealed = (await this.read())[provider]
    if (!sealed) return null
    try {
      return this.sealer.unseal(Buffer.from(sealed, "base64")) || null
    } catch {
      return null
    }
  }

  /** Saves a key, or removes it for null or blank. */
  set(provider: MediaProvider, key: string | null): Promise<MediaKeyStatus> {
    const run = this.queue.then(async () => {
      const sealed = await this.read()
      const trimmed = key?.trim() ?? ""
      if (trimmed) {
        if (!this.sealer.available()) {
          throw new Error(
            "This machine has no keychain to keep the key in, so it was not saved."
          )
        }
        sealed[provider] = Buffer.from(this.sealer.seal(trimmed)).toString(
          "base64"
        )
      } else {
        delete sealed[provider]
      }
      await mkdir(path.dirname(this.file), { recursive: true })
      // Owner-only, like the rest of what a stranger should not read.
      await writeFile(this.file, JSON.stringify(sealed, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      })
    })
    this.queue = run.catch(() => undefined)
    return run.then(() => this.status())
  }

  private async read(): Promise<Partial<Record<MediaProvider, string>>> {
    let raw: string
    try {
      raw = await readFile(this.file, "utf8")
    } catch {
      return {}
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return {}
      const out: Partial<Record<MediaProvider, string>> = {}
      for (const provider of MEDIA_PROVIDERS) {
        const value = (parsed as Record<string, unknown>)[provider]
        if (typeof value === "string" && value) out[provider] = value
      }
      return out
    } catch {
      return {}
    }
  }
}
