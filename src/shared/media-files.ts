/**
 * A video in one of the workspace's folders, as a URL a `<video>` can play.
 *
 * Not a data URL, which is how the Explorer shows a picture
 * (`readImageFile`): a render a chat has just written can be hundreds of
 * megabytes, and a player wants the bytes around wherever it is dragged to, not
 * all of them up front across the bridge. So it is a scheme of this app's,
 * served by `main/protocol.ts` with the `Range` header passed through — the
 * same bargain `note-file://` makes for a note's own videos.
 *
 * The shape lives here because both sides have to agree on it: the renderer
 * builds the URL, main reads the path back out of it and refuses one outside
 * the workspace's folders.
 */

/** Registered as a privileged scheme before the app is ready — see
 * `registerAppScheme`. */
export const MEDIA_FILE_SCHEME = "media-file"

/**
 * A constant host, for `note-file://`'s reason: a standard scheme needs one,
 * and a host is lower-cased by the URL parser — so the path goes in the path,
 * as one encoded segment, where it survives being parsed.
 */
const MEDIA_FILE_HOST = "local"

/**
 * What the Explorer plays, and what main will serve.
 *
 * One list for both, so the scheme is a way to play a video and not a way to
 * read any file in a folder by URL. Deliberately the formats Chromium plays
 * as they are: `.mkv` and `.avi` are often a codec it cannot decode, and a
 * player offered for a file it will refuse is an error box with a play button.
 */
export const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv"])

/** The extension, lowercased, without its dot — `""` for a name that has none,
 * and for a dotfile, whose leading dot is part of the name. */
function extensionOf(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop()!.toLowerCase()
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1) : ""
}

export function isVideo(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(extensionOf(filePath))
}

/**
 * The URL a player is given for `filePath`.
 *
 * `revision` goes in the query so a file rewritten on disk — the same
 * `out/video.mp4` rendered again — is a different URL, and Chromium's media
 * cache does not hand back the frames of the last one.
 */
export function mediaFileUrl(filePath: string, revision = 0): string {
  return `${MEDIA_FILE_SCHEME}://${MEDIA_FILE_HOST}/${encodeURIComponent(filePath)}?v=${revision}`
}

/** The path a media URL names, or null for anything that is not one. */
export function mediaFilePathOf(url: unknown): string | null {
  if (typeof url !== "string") return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (
    parsed.protocol !== `${MEDIA_FILE_SCHEME}:` ||
    parsed.host !== MEDIA_FILE_HOST
  )
    return null
  try {
    return decodeURIComponent(parsed.pathname.slice(1)) || null
  } catch {
    return null
  }
}
