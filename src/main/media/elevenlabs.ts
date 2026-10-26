/**
 * ElevenLabs over its REST API: speech, sound effects, and the voices to speak
 * in.
 *
 * Free of `electron` and of the MCP server that calls it — the `fetch` is an
 * argument — so `test/media-elevenlabs.ts` can check what goes over the wire
 * and what comes back without a key or a network. `host.fetch` is what the app
 * hands in, for the reason it exists: the system proxy and the OS's
 * certificates, which Node's own `fetch` honours neither of.
 *
 * Every call answers in one response — the audio is the body — so nothing here
 * polls. A video service will not be this shape.
 */

export const ELEVENLABS_API = "https://api.elevenlabs.io"

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * The model a voice speaks with when the turn names none — ElevenLabs' own
 * default, and the multilingual one, since a studio used in Vietnamese and
 * Japanese as much as in English should not need asking for that.
 */
export const DEFAULT_SPEECH_MODEL = "eleven_multilingual_v2"

/**
 * The encodings a turn may ask for.
 *
 * A few rather than the API's twenty-eight: the `pcm_*`, `ulaw_*` and `alaw_*`
 * ones are raw samples nothing in the studio can play, and the bit-rates in
 * between are a choice nobody asks a chat to make. The 192 kbps MP3 and the
 * 44.1 kHz WAV are refused by ElevenLabs below its paid tiers, and the error
 * says so — `failureOf` passes it through.
 */
export const AUDIO_FORMATS = [
  "mp3_44100_128",
  "mp3_44100_192",
  "opus_48000_128",
  "wav_24000",
  "wav_44100",
] as const

export type AudioFormat = (typeof AUDIO_FORMATS)[number]

export const DEFAULT_AUDIO_FORMAT: AudioFormat = "mp3_44100_128"

/** The extension a format's file is written under — its codec, which is the
 * part before the first `_`. */
export function extensionOfFormat(format: AudioFormat): string {
  return format.split("_")[0]!
}

export type Speech = {
  text: string
  voiceId: string
  modelId?: string
  /** ISO 639-1. Refused by the `multilingual_v2` models, which detect the
   * language themselves — so only sent when the turn names one. */
  languageCode?: string
  format?: AudioFormat
}

export type SoundEffect = {
  text: string
  /** 0.5 to 30; inferred from the prompt when absent. */
  durationSeconds?: number
  loop?: boolean
  /** 0 to 1, how literally the prompt is taken. */
  promptInfluence?: number
  format?: AudioFormat
}

export type Voice = {
  id: string
  name: string
  category: string | null
  description: string | null
  /** Accent, age, gender, use case — whatever the voice was labelled with. */
  labels: Record<string, string>
}

export type Audio = {
  bytes: Uint8Array
  extension: string
  format: AudioFormat
}

export async function speak(
  fetch: Fetch,
  key: string,
  input: Speech
): Promise<Audio> {
  const format = input.format ?? DEFAULT_AUDIO_FORMAT
  const url = `${ELEVENLABS_API}/v1/text-to-speech/${encodeURIComponent(
    input.voiceId
  )}?output_format=${format}`
  const response = await fetch(url, {
    method: "POST",
    headers: headersOf(key),
    body: JSON.stringify({
      text: input.text,
      model_id: input.modelId ?? DEFAULT_SPEECH_MODEL,
      ...(input.languageCode ? { language_code: input.languageCode } : {}),
    }),
  })
  return audioOf(response, format)
}

export async function soundEffect(
  fetch: Fetch,
  key: string,
  input: SoundEffect
): Promise<Audio> {
  const format = input.format ?? DEFAULT_AUDIO_FORMAT
  const url = `${ELEVENLABS_API}/v1/sound-generation?output_format=${format}`
  const response = await fetch(url, {
    method: "POST",
    headers: headersOf(key),
    body: JSON.stringify({
      text: input.text,
      ...(input.durationSeconds !== undefined
        ? { duration_seconds: input.durationSeconds }
        : {}),
      ...(input.loop !== undefined ? { loop: input.loop } : {}),
      ...(input.promptInfluence !== undefined
        ? { prompt_influence: input.promptInfluence }
        : {}),
    }),
  })
  return audioOf(response, format)
}

/**
 * The voices this account can speak in, by name, description or label.
 *
 * One page and no more. A turn asking for voices wants to pick one, not to
 * read a catalogue, and the account's own voices sort with the premade ones —
 * so `search` is how a turn narrows it rather than paging.
 */
export async function voices(
  fetch: Fetch,
  key: string,
  input: { search?: string; pageSize?: number }
): Promise<{ voices: Voice[]; more: boolean }> {
  const query = new URLSearchParams({
    page_size: String(Math.min(Math.max(input.pageSize ?? 20, 1), 100)),
    // Counted by default, and a cost on the server's side for a number
    // nothing here reads.
    include_total_count: "false",
  })
  if (input.search) query.set("search", input.search)

  const response = await fetch(`${ELEVENLABS_API}/v2/voices?${query}`, {
    headers: { "xi-api-key": key },
  })
  if (!response.ok) throw await failureOf(response)

  const body = (await response.json()) as {
    voices?: unknown
    has_more?: unknown
  }
  const list = Array.isArray(body.voices) ? body.voices : []
  return {
    voices: list.flatMap((entry) => {
      const voice = readVoice(entry)
      return voice ? [voice] : []
    }),
    more: body.has_more === true,
  }
}

/** One voice off the listing, or null for an entry with no id — narrowed
 * rather than cast, since the shape is ElevenLabs' to move. */
export function readVoice(entry: unknown): Voice | null {
  if (!entry || typeof entry !== "object") return null
  const record = entry as Record<string, unknown>
  if (typeof record.voice_id !== "string" || !record.voice_id) return null

  const labels: Record<string, string> = {}
  if (record.labels && typeof record.labels === "object") {
    for (const [name, value] of Object.entries(record.labels)) {
      if (typeof value === "string" && value) labels[name] = value
    }
  }

  return {
    id: record.voice_id,
    name: typeof record.name === "string" ? record.name : record.voice_id,
    category: typeof record.category === "string" ? record.category : null,
    description:
      typeof record.description === "string" && record.description
        ? record.description
        : null,
    labels,
  }
}

function headersOf(key: string): Record<string, string> {
  return { "xi-api-key": key, "Content-Type": "application/json" }
}

async function audioOf(response: Response, format: AudioFormat) {
  if (!response.ok) throw await failureOf(response)
  const bytes = new Uint8Array(await response.arrayBuffer())
  // A 200 with nothing in it is a failure too, and one that would otherwise
  // be written down as an empty file the player shows as broken.
  if (bytes.length === 0) throw new Error("ElevenLabs answered with no audio.")
  return { bytes, extension: extensionOfFormat(format), format }
}

/**
 * ElevenLabs' own sentence for a refused request, for the turn to read.
 *
 * Two shapes come back: `{ detail: { status, message } }` for a refusal —
 * a bad key, no credits left, a voice that does not exist — and
 * `{ detail: [{ loc, msg }] }` for a request that did not validate. Either is
 * more use to the model than a status code, since it is what decides whether
 * to try another voice or to stop and tell the user their quota is gone.
 */
export async function failureOf(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "")
  let message: string | null = null
  try {
    const { detail } = JSON.parse(text) as { detail?: unknown }
    if (typeof detail === "string") message = detail
    else if (Array.isArray(detail)) {
      message = detail
        .map((entry) => {
          const record = entry as { loc?: unknown; msg?: unknown }
          const where = Array.isArray(record.loc)
            ? record.loc.filter((part) => part !== "body").join(".")
            : ""
          return where ? `${where}: ${String(record.msg)}` : String(record.msg)
        })
        .join("; ")
    } else if (detail && typeof detail === "object") {
      const record = detail as { message?: unknown; status?: unknown }
      if (typeof record.message === "string") message = record.message
      else if (typeof record.status === "string") message = record.status
    }
  } catch {
    // Not JSON — a proxy's page, most likely. The status line says enough.
  }

  if (response.status === 401 && !message) {
    message = "the API key was refused — check it in Settings › Media"
  }
  return new Error(
    `ElevenLabs refused the request (${response.status}): ${
      message ?? (text.slice(0, 300) || response.statusText)
    }`
  )
}
