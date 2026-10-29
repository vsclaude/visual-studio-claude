import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  scaffoldFiles,
  VIDEO_FORMATS,
  VIDEO_OUTPUT,
  videoTitle,
  type Video,
  type VideoFormat,
  type VideoRecord,
} from "../shared/video"

/**
 * The videos made with `/video`, as folders under the app's own data —
 * `~/.veystudio/videos/<uuid>/`, each with a `video.json` (which project and
 * chat it belongs to) beside its Remotion source. Not in the project: a video
 * is the chat's work rather than the repository's, and a `videos/` folder that
 * appears in somebody's checkout is a diff they never asked for. What this
 * module writes is the scaffold and that record; the animation is the chat's,
 * and the render is `video-engine.ts`'s. Free of `electron` (`test/video.ts`).
 */

const RECORD = "video.json"

/** Every video under `root`, newest first. A folder without a readable
 * `video.json` is not one of ours and is skipped, not reported. */
export async function listVideos(root: string): Promise<Video[]> {
  let names: string[]
  try {
    names = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
  const read = await Promise.all(
    names.map((name) => readVideo(path.join(root, name)))
  )
  return read
    .filter((video): video is Video => video !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function readVideo(dir: string): Promise<Video | null> {
  let record: VideoRecord
  try {
    record = recordOf(
      JSON.parse(await readFile(path.join(dir, RECORD), "utf8"))
    )
  } catch {
    return null
  }
  const output = path.join(dir, VIDEO_OUTPUT)
  const rendered = await stat(output).catch(() => null)
  return {
    ...record,
    dir,
    output: rendered ? output : null,
    renderedAt: rendered ? rendered.mtimeMs : null,
    editedAt: await newestUnder(path.join(dir, "src")),
  }
}

/** The newest mtime of any file under `dir`, 0 for none — what says the chat
 * has changed the code since the last render. */
async function newestUnder(dir: string): Promise<number> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  const times = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) return newestUnder(target)
      return (await stat(target).catch(() => null))?.mtimeMs ?? 0
    })
  )
  return Math.max(0, ...times)
}

/** A `video.json` as written by any build, narrowed: a hand-edited one with a
 * field missing still lists, with that field at its default. */
function recordOf(value: unknown): VideoRecord {
  if (!value || typeof value !== "object") throw new Error("Not a record")
  const raw = value as Record<string, unknown>
  const format =
    typeof raw.format === "string" && raw.format in VIDEO_FORMATS
      ? (raw.format as VideoFormat)
      : "landscape"
  return {
    folderId: typeof raw.folderId === "string" ? raw.folderId : "",
    title: typeof raw.title === "string" ? raw.title : "Video",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    format,
    seconds: typeof raw.seconds === "number" ? raw.seconds : 10,
    chatId: typeof raw.chatId === "string" ? raw.chatId : null,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date(0).toISOString(),
  }
}

/** A new video's folder, scaffolded so it renders a placeholder before the
 * chat has written a line. */
export async function createVideo(
  root: string,
  folderId: string,
  request: { prompt: string; format: VideoFormat; seconds: number }
): Promise<Video> {
  await mkdir(root, { recursive: true })
  const title = videoTitle(request.prompt)
  // A UUID rather than a name off the title: nothing reads the folder's name
  // but this app, a title can change, and two videos asked for in the same
  // words are two folders without a numbering rule to get right.
  const dir = path.join(root, randomUUID())

  const record: VideoRecord = {
    folderId,
    title,
    prompt: request.prompt.trim(),
    format: request.format,
    seconds: Math.min(120, Math.max(1, Math.round(request.seconds))),
    chatId: null,
    createdAt: new Date().toISOString(),
  }
  await mkdir(dir)
  for (const [file, text] of Object.entries(scaffoldFiles(record))) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true })
    await writeFile(path.join(dir, file), text)
  }
  await writeRecord(dir, record)
  return (await readVideo(dir))!
}

/** The scaffold's helpers a video made by an older build lacks, written in
 * before a render — the rules every message carries tell the chat they are
 * there. Only what is missing: a helper the chat has edited is its own. */
export async function restoreHelpers(dir: string): Promise<void> {
  const record = recordOf(
    JSON.parse(await readFile(path.join(dir, RECORD), "utf8"))
  )
  const files = scaffoldFiles(record)
  for (const file of ["src/sound.ts", "src/music.ts"]) {
    const target = path.join(dir, file)
    if (await stat(target).catch(() => null)) continue
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, files[file]!)
  }
}

/** Names the chat writing a video, once it has one. */
export async function setVideoChat(dir: string, chatId: string): Promise<void> {
  const record = recordOf(
    JSON.parse(await readFile(path.join(dir, RECORD), "utf8"))
  )
  await writeRecord(dir, { ...record, chatId })
}

function writeRecord(dir: string, record: VideoRecord): Promise<void> {
  return writeFile(
    path.join(dir, RECORD),
    `${JSON.stringify(record, null, 2)}\n`
  )
}
