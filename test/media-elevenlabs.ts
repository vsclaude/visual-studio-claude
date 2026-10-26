import {
  DEFAULT_SPEECH_MODEL,
  extensionOfFormat,
  failureOf,
  readVoice,
  soundEffect,
  speak,
  voices,
  type Fetch,
} from "../src/main/media/elevenlabs"
import { check, finish, section } from "./harness"

/**
 * What goes over the wire to ElevenLabs and what is made of the answer —
 * against a fake `fetch`, since the real one needs a key and spends credits.
 */

type Call = { url: string; init: RequestInit | undefined }

function fake(response: () => Response): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init })
      return response()
    },
  }
}

const audio = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  })

const bodyOf = (call: Call | undefined) =>
  JSON.parse(String(call?.init?.body ?? "{}")) as Record<string, unknown>

section("speech")
{
  const { fetch, calls } = fake(audio)
  const result = await speak(fetch, "sk-1", {
    text: "Xin chào",
    voiceId: "voice/1",
  })
  const call = calls[0]
  check(
    "posts to the voice's endpoint, id escaped, mp3 by default",
    call?.url ===
      "https://api.elevenlabs.io/v1/text-to-speech/voice%2F1?output_format=mp3_44100_128",
    call?.url
  )
  check("as a POST", call?.init?.method === "POST")
  check(
    "with the key in xi-api-key",
    (call?.init?.headers as Record<string, string>)["xi-api-key"] === "sk-1"
  )
  check(
    "the multilingual model when none is named",
    bodyOf(call).model_id === DEFAULT_SPEECH_MODEL
  )
  check(
    "and no language_code, which that model refuses",
    !("language_code" in bodyOf(call))
  )
  check("answers with the bytes", result.bytes.length === 3)
  check("as an mp3", result.extension === "mp3")
}

section("speech with everything named")
{
  const { fetch, calls } = fake(audio)
  const result = await speak(fetch, "k", {
    text: "hi",
    voiceId: "v",
    modelId: "eleven_turbo_v2_5",
    languageCode: "vi",
    format: "wav_24000",
  })
  check("the format on the query", calls[0]?.url.endsWith("wav_24000") === true)
  check("the model", bodyOf(calls[0]).model_id === "eleven_turbo_v2_5")
  check("the language", bodyOf(calls[0]).language_code === "vi")
  check("a .wav", result.extension === "wav")
}

section("sound effects")
{
  const { fetch, calls } = fake(audio)
  await soundEffect(fetch, "k", { text: "rain", durationSeconds: 4 })
  check(
    "posts to sound-generation",
    calls[0]?.url ===
      "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"
  )
  const body = bodyOf(calls[0])
  check(
    "with the text and duration",
    body.text === "rain" && body.duration_seconds === 4
  )
  check(
    "and nothing it was not given",
    !("loop" in body) && !("prompt_influence" in body)
  )
}

section("an empty answer is a failure")
{
  const { fetch } = fake(() => new Response(new Uint8Array(), { status: 200 }))
  const error = await speak(fetch, "k", { text: "x", voiceId: "v" }).catch(
    (thrown: Error) => thrown
  )
  check("rather than an empty file", error instanceof Error)
}

section("voices")
{
  const { fetch, calls } = fake(
    () =>
      new Response(
        JSON.stringify({
          voices: [
            {
              voice_id: "a1",
              name: "Aria",
              category: "premade",
              description: "",
              labels: { accent: "american", gender: "female", age: 3 },
            },
            { name: "no id" },
          ],
          has_more: true,
        }),
        { status: 200 }
      )
  )
  const result = await voices(fetch, "k", { search: "female", pageSize: 500 })
  const url = new URL(calls[0]!.url)
  check("asks v2", url.pathname === "/v2/voices")
  check("with the search", url.searchParams.get("search") === "female")
  check("page size held to 100", url.searchParams.get("page_size") === "100")
  check("an entry with no id is dropped", result.voices.length === 1)
  check("more is passed on", result.more)
  const aria = result.voices[0]
  check(
    "an empty description is none",
    aria?.description === null && aria.category === "premade"
  )
  check(
    "only string labels are kept",
    JSON.stringify(aria?.labels) ===
      JSON.stringify({ accent: "american", gender: "female" })
  )
  check("readVoice refuses a non-object", readVoice("x") === null)
}

section("refusals, in ElevenLabs' own words")
{
  const refusal = await failureOf(
    new Response(
      JSON.stringify({
        detail: { status: "quota_exceeded", message: "You have 0 credits." },
      }),
      { status: 401 }
    )
  )
  check(
    "a detail object's message",
    refusal.message.includes("(401)") &&
      refusal.message.includes("You have 0 credits."),
    refusal.message
  )

  const invalid = await failureOf(
    new Response(
      JSON.stringify({
        detail: [{ loc: ["body", "text"], msg: "field required" }],
      }),
      { status: 422 }
    )
  )
  check(
    "a validation list, located",
    invalid.message.includes("text: field required"),
    invalid.message
  )

  const bare = await failureOf(new Response("", { status: 401 }))
  check(
    "a bare 401 points at Settings",
    bare.message.includes("Settings › Media"),
    bare.message
  )

  const proxy = await failureOf(
    new Response("<html>Bad gateway</html>", { status: 502 })
  )
  check("a page that is not JSON", proxy.message.includes("Bad gateway"))
}

section("extensions")
{
  check("opus", extensionOfFormat("opus_48000_128") === "opus")
  check("mp3", extensionOfFormat("mp3_44100_192") === "mp3")
}

finish()
