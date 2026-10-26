import path from "node:path"

import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

import type { MediaProvider } from "../../shared/media"
import {
  AUDIO_FORMATS,
  soundEffect,
  speak,
  voices,
  type Audio,
  type Fetch,
} from "./elevenlabs"
import { mediaTarget, writeMedia } from "./output"

/**
 * The server's name, and so the middle of every tool's wire name:
 * `mcp__media__elevenlabs_speech`.
 */
export const MEDIA_SERVER = "media"

export type MediaServerInput = {
  /** The chat's directory — where files are written, and what a requested
   * path is held inside. */
  cwd: string
  /** The services with a key. A service without one has no tools here at
   * all, rather than tools that fail: a tool the model can see is a tool it
   * will try. */
  providers: MediaProvider[]
  /** Read at each call, so a key replaced in Settings is the one spent next. */
  keyOf: (provider: MediaProvider) => Promise<string | null>
  fetch: Fetch
}

/**
 * The studio's own MCP server, for one chat session.
 *
 * **In this process**, through the SDK's `createSdkMcpServer`, and that is the
 * difference from the three `yasuo-*` servers this app used to serve: those
 * were a config the CLI was handed on its command line, and the reason they
 * went was partly that a command line is readable by every process on the
 * machine. Here the CLI is told only a name and a type; every call comes back
 * over the control channel to these handlers, so the key never leaves main and
 * never reaches the CLI at all. Measured against the user's own `claude` before
 * this was written: the CLI's own servers still load beside it, and a
 * 200-second call is not cut off.
 *
 * One instance per session, because an MCP server is connected to one
 * transport — `chat.ts` builds it in `open`.
 *
 * What each call costs is the user's money with a third party, so the modes
 * treat these like any MCP tool (`PERMISSIONS` in `chat.ts`): refused in Plan
 * and Read only, asked about in Ask and Edits, run in Full access.
 */
export function mediaServer(
  input: MediaServerInput
): McpSdkServerConfigWithInstance {
  const tools = input.providers.includes("elevenlabs")
    ? elevenLabsTools(input)
    : []
  return createSdkMcpServer({
    name: MEDIA_SERVER,
    version: "1.0.0",
    instructions:
      "Generates audio with the user's own account on a third-party service, and writes it into the project. Each call spends the user's credits there, so make one when it was asked for, not to try things out.",
    tools,
  })
}

const format = z
  .enum(AUDIO_FORMATS)
  .optional()
  .describe(
    "Codec, sample rate and bitrate. Defaults to mp3_44100_128; leave it unless the user asked for a format."
  )

const output = z
  .string()
  .optional()
  .describe(
    "Where to write the file, relative to the project. The extension is set from the format. Omit to write under media/."
  )

/** Exported for `test/media-server.ts`, which calls the handlers directly —
 * an SDK server's instance is only reachable through a CLI's transport. */
export function elevenLabsTools(input: MediaServerInput) {
  const keyed = async <T>(
    run: (key: string) => Promise<T>
  ): Promise<T | string> => {
    const key = await input.keyOf("elevenlabs")
    if (!key) {
      return "There is no ElevenLabs API key in Settings › Media any more. Ask the user to add one."
    }
    return run(key)
  }

  return [
    tool(
      "elevenlabs_voices",
      "Lists the ElevenLabs voices the user's account can speak in, with their ids. Call it to choose a voice_id for elevenlabs_speech. Free: it spends no credits.",
      {
        search: z
          .string()
          .optional()
          .describe(
            "Filters by name, description, labels or category, e.g. 'female british' or 'narration'."
          ),
        page_size: z.number().int().min(1).max(100).optional(),
      },
      (args) =>
        answer(async () => {
          const result = await keyed((key) =>
            voices(input.fetch, key, {
              search: args.search,
              pageSize: args.page_size,
            })
          )
          if (typeof result === "string") return failed(result)
          if (result.voices.length === 0) {
            return said(
              args.search
                ? `No voices match "${args.search}". Try a broader search, or none.`
                : "This account has no voices."
            )
          }
          const lines = result.voices.map((voice) => {
            const labels = Object.values(voice.labels).join(", ")
            const about = [voice.category, labels, voice.description]
              .filter(Boolean)
              .join(" · ")
            return `- ${voice.name} — voice_id ${voice.id}${about ? ` (${about})` : ""}`
          })
          if (result.more) {
            lines.push("More voices exist; narrow with search to see them.")
          }
          return said(lines.join("\n"))
        }),
      {
        annotations: { readOnlyHint: true, openWorldHint: true },
        searchHint: "elevenlabs voice list text to speech tts audio",
      }
    ),

    tool(
      "elevenlabs_speech",
      "Turns text into spoken audio with an ElevenLabs voice and writes the file into the project. Spends the user's ElevenLabs credits, per character. Get a voice_id from elevenlabs_voices first.",
      {
        text: z.string().min(1).describe("What to say, exactly as spoken."),
        voice_id: z.string().min(1),
        model_id: z
          .string()
          .optional()
          .describe(
            "Defaults to eleven_multilingual_v2, which reads most languages. Leave it unless the user named a model."
          ),
        language_code: z
          .string()
          .optional()
          .describe(
            "ISO 639-1, only for a model that takes one; the multilingual_v2 models detect the language themselves and refuse it."
          ),
        format,
        output,
      },
      (args) =>
        answer(async () => {
          const audio = await keyed((key) =>
            speak(input.fetch, key, {
              text: args.text,
              voiceId: args.voice_id,
              modelId: args.model_id,
              languageCode: args.language_code,
              format: args.format,
            })
          )
          if (typeof audio === "string") return failed(audio)
          return written(input.cwd, args.output, args.text, audio)
        }),
      {
        annotations: { openWorldHint: true },
        searchHint:
          "elevenlabs text to speech tts voiceover narration speak audio mp3",
      }
    ),

    tool(
      "elevenlabs_sound_effect",
      "Generates a sound effect or short ambience from a description with ElevenLabs and writes the file into the project. Spends the user's ElevenLabs credits.",
      {
        text: z
          .string()
          .min(1)
          .describe("The sound, described, e.g. 'rain on a tin roof'."),
        duration_seconds: z
          .number()
          .min(0.5)
          .max(30)
          .optional()
          .describe("0.5 to 30. Omit to let the model choose from the text."),
        loop: z
          .boolean()
          .optional()
          .describe("Whether it should loop seamlessly."),
        prompt_influence: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "0 to 1; higher follows the text more literally. Defaults to 0.3."
          ),
        format,
        output,
      },
      (args) =>
        answer(async () => {
          const audio = await keyed((key) =>
            soundEffect(input.fetch, key, {
              text: args.text,
              durationSeconds: args.duration_seconds,
              loop: args.loop,
              promptInfluence: args.prompt_influence,
              format: args.format,
            })
          )
          if (typeof audio === "string") return failed(audio)
          return written(input.cwd, args.output, args.text, audio)
        }),
      {
        annotations: { openWorldHint: true },
        searchHint: "elevenlabs sound effect sfx ambience foley audio",
      }
    ),
  ]
}

async function written(
  cwd: string,
  requested: string | undefined,
  about: string,
  audio: Audio
) {
  const target = mediaTarget({
    cwd,
    requested,
    about,
    extension: audio.extension,
  })
  const file = await writeMedia(target, audio.bytes)
  const relative = path.relative(cwd, file).split(path.sep).join("/")
  const size = `${Math.max(1, Math.round(audio.bytes.length / 1024))} KB`
  return said(
    `Wrote ${relative} (${size}, ${audio.format}). The user can play it from the Explorer.`
  )
}

type Result = {
  content: { type: "text"; text: string }[]
  isError?: boolean
}

function said(text: string): Result {
  return { content: [{ type: "text", text }] }
}

function failed(text: string): Result {
  return { content: [{ type: "text", text }], isError: true }
}

/** A thrown failure as the tool's answer rather than as the MCP call's: the
 * model reads `isError` and decides what to do, where a rejected handler is a
 * protocol error it is told nothing useful about. */
async function answer(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run()
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error))
  }
}
