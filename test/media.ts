import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { mediaTarget, slugOf, writeMedia } from "../src/main/media/output"
import {
  isMediaProvider,
  mediaFilePathOf,
  mediaFileUrl,
  mediaKindOf,
} from "../src/shared/media"
import { check, finish, section } from "./harness"

/**
 * Where a generated file is written, and the URL the Explorer plays one by.
 */

section("what plays")
{
  check("an mp3 is audio", mediaKindOf("/w/media/a.mp3") === "audio")
  check("case does not matter", mediaKindOf("C:\\w\\A.WAV") === "audio")
  check("an mp4 is video", mediaKindOf("/w/clip.mp4") === "video")
  check("raw pcm is nothing", mediaKindOf("/w/a.pcm") === null)
  check("a dotfile is nothing", mediaKindOf("/w/.mp3") === null)
  check("a source file is nothing", mediaKindOf("/w/a.ts") === null)
}

section("the player's URL")
{
  const file = "/Users/me/My Project/media/xin chào #1.mp3"
  const url = mediaFileUrl(file)
  check("round-trips a path with spaces and a #", mediaFilePathOf(url) === file)
  check("ignores a query", mediaFilePathOf(`${url}?v=2`) === file)
  check("another scheme is not ours", mediaFilePathOf("file:///a.mp3") === null)
  check(
    "a malformed escape is nothing rather than a throw",
    mediaFilePathOf("vsc-media://file/%E0%A4%A") === null
  )
}

section("providers")
{
  check("elevenlabs is one", isMediaProvider("elevenlabs"))
  check("anything else is not", !isMediaProvider("sora"))
}

section("names nobody gave")
{
  check(
    "a few words of the prompt",
    slugOf("Welcome to the studio, everyone! And more words") ===
      "welcome-to-the-studio-everyone-and"
  )
  check(
    "Vietnamese without its marks",
    slugOf("Xin chào, đây là Vey Studio") === "xin-chao-day-la-vey-studio",
    slugOf("Xin chào, đây là Vey Studio")
  )
  check("Japanese is named for what it is", slugOf("こんにちは") === "audio")

  const target = mediaTarget({
    cwd: "/w/project",
    about: "Rain on a roof",
    extension: "mp3",
    now: new Date(2026, 9, 26, 14, 30, 5),
  })
  check(
    "under media/, stamped",
    target ===
      path.join("/w/project", "media", "rain-on-a-roof-20261026-143005.mp3"),
    target
  )
}

section("names a turn gave")
{
  const inside = mediaTarget({
    cwd: "/w/project",
    requested: "assets/intro.wav",
    about: "x",
    extension: "mp3",
  })
  check(
    "kept, with the format's extension",
    inside === path.join("/w/project", "assets", "intro.mp3"),
    inside
  )

  let refused = false
  try {
    mediaTarget({
      cwd: "/w/project",
      requested: "../elsewhere/intro.mp3",
      about: "x",
      extension: "mp3",
    })
  } catch {
    refused = true
  }
  check("one outside the project is refused", refused)

  let absolute = false
  try {
    mediaTarget({
      cwd: "/w/project",
      requested: "/etc/intro.mp3",
      about: "x",
      extension: "mp3",
    })
  } catch {
    absolute = true
  }
  check("and so is an absolute one elsewhere", absolute)
}

section("never over a file already there")
{
  const dir = await mkdtemp(path.join(tmpdir(), "media-test-"))
  try {
    const target = path.join(dir, "media", "take.mp3")
    const first = await writeMedia(target, new Uint8Array([1]))
    const second = await writeMedia(target, new Uint8Array([2]))
    check("the first lands where asked", first === target)
    check(
      "the second beside it",
      second === path.join(dir, "media", "take-2.mp3"),
      second
    )
    check(
      "and the first is untouched",
      (await readFile(first))[0] === 1 &&
        (await readdir(path.join(dir, "media"))).length === 2
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

finish()
