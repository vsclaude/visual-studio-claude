/**
 * Generated audio and video: which services a chat can reach, and how the
 * renderer plays what they made.
 *
 * The generating is a chat's — the studio's own `media` MCP server, served in
 * the main process (`main/media/`), is how a turn reaches a service — and this
 * file is the part both sides need: the services' names, which of them have a
 * key, and the URL a file is played through. `docs/design.md` § Generating
 * audio has the argument.
 */

/** Every service the `media` server can reach, in the order Settings lists
 * them. A service with no key is one whose tools a turn is never shown. */
export const MEDIA_PROVIDERS = ["elevenlabs"] as const

export type MediaProvider = (typeof MEDIA_PROVIDERS)[number]

export const MEDIA_PROVIDER_LABELS: Record<MediaProvider, string> = {
  elevenlabs: "ElevenLabs",
}

export function isMediaProvider(value: unknown): value is MediaProvider {
  return (MEDIA_PROVIDERS as readonly unknown[]).includes(value)
}

/**
 * Which services have a key — all the renderer is ever told about one.
 *
 * Never the key itself: it is typed into Settings once, sealed by the OS
 * keychain in main and read back only by the tool call that spends it, so there
 * is nothing on this side of the bridge a plugin could lift.
 */
export type MediaKeyStatus = {
  keys: Record<MediaProvider, boolean>
  /** False where the OS offers no keychain to seal with — a Linux session
   * with no secret service — in which case no key can be saved at all, rather
   * than one written in the clear. */
  sealable: boolean
}

/**
 * What the Explorer plays rather than opens as text.
 *
 * The formats Chromium decodes without help, and so the ones a player is worth
 * offering for. Not `.pcm`, which the services can produce and nothing can play:
 * raw samples with no header are not a file a `<audio>` can read.
 */
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "m4a",
  "aac",
  "flac",
])

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"])

export type MediaKind = "audio" | "video"

export function mediaKindOf(filePath: string): MediaKind | null {
  const name = filePath.split(/[\\/]/).pop() ?? ""
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return null
  const extension = name.slice(dot + 1).toLowerCase()
  if (AUDIO_EXTENSIONS.has(extension)) return "audio"
  if (VIDEO_EXTENSIONS.has(extension)) return "video"
  return null
}

/**
 * The scheme a workspace's audio and video are played through.
 *
 * A URL rather than bytes across the bridge, unlike a picture: a player asks
 * for the head of the file and then for whatever range somebody seeks to, and a
 * minute of video as one base64 string is the thing a `Range` request exists
 * to avoid. Served by `serveMediaFiles` in `main/protocol.ts`, which answers
 * only for a file inside the workspace's folders whose extension is one of the
 * above — so this is a player's way in, not a general file reader.
 */
export const MEDIA_FILE_SCHEME = "vsc-media"

/** A constant, for the reason `NOTE_FILE_HOST` is one: a host is lower-cased
 * by the URL parser, so the path travels as a path segment instead. */
const MEDIA_FILE_HOST = "file"

const PREFIX = `${MEDIA_FILE_SCHEME}://${MEDIA_FILE_HOST}/`

export function mediaFileUrl(filePath: string): string {
  return `${PREFIX}${encodeURIComponent(filePath)}`
}

export function mediaFilePathOf(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith(PREFIX)) return null
  // A query is the renderer's cache-buster, never part of the path.
  const encoded = url.slice(PREFIX.length).split("?")[0] ?? ""
  try {
    return decodeURIComponent(encoded) || null
  } catch {
    return null
  }
}
