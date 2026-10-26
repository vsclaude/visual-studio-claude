import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { Fetch } from "../src/main/media/elevenlabs"
import {
  elevenLabsTools,
  mediaServer,
  MEDIA_SERVER,
  type MediaServerInput,
} from "../src/main/media/server"
import { check, finish, section } from "./harness"

/**
 * The `media` server's tools, called the way the CLI would call them: which
 * exist, what a call writes, and what the model is told when one fails.
 */

type Text = { content: { type: string; text: string }[]; isError?: boolean }

const textOf = (result: unknown) =>
  (result as Text).content.map((part) => part.text).join("\n")

const dir = await mkdtemp(path.join(tmpdir(), "media-server-"))
try {
  let key: string | null = "sk-1"
  const calls: string[] = []
  const fetch: Fetch = async (url) => {
    calls.push(url)
    if (url.includes("/v2/voices")) {
      return new Response(
        JSON.stringify({
          voices: [{ voice_id: "v1", name: "Aria", labels: { accent: "us" } }],
          has_more: false,
        })
      )
    }
    if (url.includes("bad-voice")) {
      return new Response(
        JSON.stringify({ detail: { message: "Voice not found." } }),
        { status: 404 }
      )
    }
    return new Response(new Uint8Array([7, 7, 7]))
  }
  const input: MediaServerInput = {
    cwd: dir,
    providers: ["elevenlabs"],
    keyOf: async () => key,
    fetch,
  }
  const tools = elevenLabsTools(input)
  /** One tool, called with whatever arguments a test hands it — the way the
   * CLI calls it after the server has validated them. Typed loosely because
   * the three tools' schemas differ, and a union of their handlers takes only
   * arguments all three accept. */
  const named = (name: string) => {
    const found = tools.find((entry) => entry.name === name)
    if (!found) throw new Error(`no ${name}`)
    return found as unknown as {
      handler: (args: Record<string, unknown>, extra: unknown) => Promise<Text>
    }
  }

  section("the server")
  {
    check("is named media", mediaServer(input).name === MEDIA_SERVER)
    check(
      "offers the three ElevenLabs tools",
      tools.map((entry) => entry.name).join() ===
        "elevenlabs_voices,elevenlabs_speech,elevenlabs_sound_effect"
    )
    check(
      "and none without a key",
      mediaServer({ ...input, providers: [] }).type === "sdk"
    )
  }

  section("voices")
  {
    const result = await named("elevenlabs_voices").handler({}, undefined)
    check(
      "lists each with its id",
      textOf(result).includes("Aria — voice_id v1")
    )
  }

  section("speech")
  {
    const result = (await named("elevenlabs_speech").handler(
      { text: "Hello there", voice_id: "v1" },
      undefined
    )) as Text
    check("succeeds", result.isError !== true, result)
    const written = await readdir(path.join(dir, "media"))
    check("writes one file under media/", written.length === 1, written)
    check(
      "named for the prompt",
      written[0]?.startsWith("hello-there-") === true &&
        written[0].endsWith(".mp3")
    )
    check(
      "holding the bytes",
      (await readFile(path.join(dir, "media", written[0]!))).length === 3
    )
    check(
      "and tells the model where, relative to the project",
      textOf(result).includes(`Wrote media/${written[0]}`),
      textOf(result)
    )
  }

  section("speech to a named path")
  {
    const result = (await named("elevenlabs_speech").handler(
      { text: "x", voice_id: "v1", output: "audio/intro.wav" },
      undefined
    )) as Text
    check(
      "lands there, as the format's extension",
      textOf(result).includes("Wrote audio/intro.mp3"),
      textOf(result)
    )
    const outside = (await named("elevenlabs_speech").handler(
      { text: "x", voice_id: "v1", output: "../../escape.mp3" },
      undefined
    )) as Text
    check("but not outside the project", outside.isError === true)
  }

  section("failures are answers, not throws")
  {
    const refused = (await named("elevenlabs_speech").handler(
      { text: "x", voice_id: "bad-voice" },
      undefined
    )) as Text
    check(
      "ElevenLabs' sentence reaches the model",
      refused.isError === true && textOf(refused).includes("Voice not found."),
      textOf(refused)
    )

    key = null
    const before = calls.length
    const keyless = (await named("elevenlabs_sound_effect").handler(
      { text: "rain" },
      undefined
    )) as Text
    check(
      "a key removed since the session opened says so",
      keyless.isError === true && textOf(keyless).includes("Settings › Media")
    )
    check("without calling out", calls.length === before)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

finish()
