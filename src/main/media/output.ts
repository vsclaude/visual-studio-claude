import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * Where a generated file goes, and writing it there.
 *
 * Into the chat's own directory — the project — rather than anywhere of the
 * studio's: a voiceover is part of the work it was made for, so it is a file
 * the Explorer shows, git sees and the next turn can `Read` by the path it was
 * told. `media/` unless the turn names a place, since a model asked for "a
 * voiceover" has no better idea where it belongs than a folder of its own.
 */
export const MEDIA_DIR = "media"

/**
 * The path a file is written to, or a throw naming why not.
 *
 * `requested` is the model's, and so is held to the directory the way a
 * `files:*` path is held to the roots: resolved, and refused if it lands
 * outside. The extension is the format's, whatever the request said — a file
 * named `.wav` holding MP3 bytes is one every player reads wrongly — so a
 * different one is replaced rather than refused.
 */
export function mediaTarget(input: {
  cwd: string
  requested?: string
  /** What the file is of — the prompt — for naming one nobody named. */
  about: string
  extension: string
  now?: Date
}): string {
  const base = path.resolve(input.cwd)

  if (input.requested?.trim()) {
    const resolved = path.resolve(base, input.requested.trim())
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(
        `${input.requested} is outside the project; give a path inside it, or none.`
      )
    }
    const parsed = path.parse(resolved)
    if (!parsed.name) throw new Error(`${input.requested} names no file.`)
    return path.join(parsed.dir, `${parsed.name}.${input.extension}`)
  }

  const name = `${slugOf(input.about)}-${stampOf(input.now ?? new Date())}`
  return path.join(base, MEDIA_DIR, `${name}.${input.extension}`)
}

/**
 * A few words of the prompt, as a filename.
 *
 * ASCII only, because a name is something typed into a terminal later and a
 * Vietnamese prompt's diacritics are the first thing a shell quotes wrong. A
 * prompt with no ASCII letters at all — Japanese, say — is named for what the
 * file is rather than left empty.
 */
export function slugOf(text: string): string {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6)
  return words.join("-").slice(0, 48).replace(/-+$/, "") || "audio"
}

/** `20261026-143005`: sorts by when, and is never the same twice in one
 * project unless two land in the same second — which `writeMedia` covers. */
function stampOf(now: Date): string {
  const two = (value: number) => String(value).padStart(2, "0")
  return (
    `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-` +
    `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  )
}

/**
 * Writes the bytes, never over a file that is already there.
 *
 * `wx`, and a `-2`, `-3` on the name until one is free: a turn asked twice for
 * `media/intro.mp3` keeps both takes, and the first one is never the thing a
 * second request quietly replaced. Answers with the path written.
 */
export async function writeMedia(
  target: string,
  bytes: Uint8Array
): Promise<string> {
  await mkdir(path.dirname(target), { recursive: true })
  const parsed = path.parse(target)
  for (let attempt = 1; attempt < 100; attempt++) {
    const candidate =
      attempt === 1
        ? target
        : path.join(parsed.dir, `${parsed.name}-${attempt}${parsed.ext}`)
    try {
      await writeFile(candidate, bytes, { flag: "wx" })
      return candidate
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
  }
  throw new Error(`Too many files named ${parsed.base} already.`)
}
