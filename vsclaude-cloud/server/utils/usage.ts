/**
 * What a request cost, read off Anthropic's own answer — what it takes off
 * the user's credits.
 *
 * Credits are counted in **input-token equivalents** rather than raw tokens,
 * so one number covers a request that is mostly cache reads and one that is
 * mostly output: each kind is weighted by its price relative to an uncached
 * input token (Anthropic's ratios — cache writes 1.25×, cache reads 0.1×,
 * output 5×). A million credits are then "what a million fresh Haiku input
 * tokens would cost", whatever the mix — and whatever the model, since
 * Sonnet and Opus are counted at their own price (`MODEL_PRICES`).
 */

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export const NO_USAGE: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

/**
 * Haiku 5.5 charges every token of a request fivefold once its prompt passes
 * 100K. The route refuses such prompts, but a count that could not be had lets
 * one through, and the credits should then be spent at what it really cost.
 */
export const LONG_PROMPT = 100_000

/**
 * What a model's tokens cost against Haiku's, the unit credits are counted
 * in: Sonnet 5.5's input is $2/MTok and Opus 5.5's $4 against Haiku's $0.10.
 * An Opus turn has to spend credits at Opus's price, or a pack is a promise
 * of forty times what it says.
 *
 * Their cache reads are 0.05× input rather than Haiku's 0.1×, and neither has
 * Haiku's long-prompt surcharge — the full context is one price.
 * (platform.claude.com/docs/en/about-claude/pricing, read 2026-10-18.)
 */
type ModelPrice = { factor: number; cacheRead: number; longPrompt: boolean }

const HAIKU: ModelPrice = { factor: 1, cacheRead: 0.1, longPrompt: true }
const SONNET: ModelPrice = { factor: 20, cacheRead: 0.05, longPrompt: false }
const OPUS: ModelPrice = { factor: 40, cacheRead: 0.05, longPrompt: false }

/** By family, and an unknown model at the dearest price: a model added to a
 * the credit models before this table learns it is overcharged rather than
 * given away. */
function priceOf(model: string): ModelPrice {
  if (/haiku/i.test(model)) return HAIKU
  if (/sonnet/i.test(model)) return SONNET
  return OPUS
}

export function weighted(usage: Usage, model = "claude-haiku-5-5"): number {
  const price = priceOf(model)
  const prompt =
    usage.input_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens
  return Math.ceil(
    (usage.input_tokens +
      usage.cache_creation_input_tokens * 1.25 +
      usage.cache_read_input_tokens * price.cacheRead +
      usage.output_tokens * 5) *
      price.factor *
      (price.longPrompt && prompt > LONG_PROMPT ? 5 : 1)
  )
}

/** The `usage` object of a message or a delta, with anything missing as 0 —
 * a delta carries only the fields that moved. */
export function usageOf(raw: unknown, base: Usage = NO_USAGE): Usage {
  if (!raw || typeof raw !== "object") return base
  const fields = raw as Record<string, unknown>
  const pick = (key: keyof Usage) =>
    typeof fields[key] === "number" ? (fields[key] as number) : base[key]
  return {
    input_tokens: pick("input_tokens"),
    output_tokens: pick("output_tokens"),
    cache_creation_input_tokens: pick("cache_creation_input_tokens"),
    cache_read_input_tokens: pick("cache_read_input_tokens"),
  }
}

/**
 * Follows a streamed answer's usage without touching the stream.
 *
 * `message_start` carries the input side and an output count of a token or
 * two; each `message_delta` carries the **running** output total (not an
 * increment), and may restate the input side. So the last value seen of each
 * field is the answer.
 */
export class StreamUsage {
  usage: Usage = NO_USAGE
  private buffer = ""
  private readonly decoder = new TextDecoder()

  push(chunk: Uint8Array): void {
    this.buffer += this.decoder
      .decode(chunk, { stream: true })
      .replace(/\r\n/g, "\n")
    let end: number
    // An SSE event ends at a blank line; a chunk can end mid-event.
    while ((end = this.buffer.indexOf("\n\n")) !== -1) {
      this.read(this.buffer.slice(0, end))
      this.buffer = this.buffer.slice(end + 2)
    }
  }

  private read(event: string): void {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue
      let data: unknown
      try {
        data = JSON.parse(line.slice(5).trim())
      } catch {
        continue
      }
      if (!data || typeof data !== "object") continue
      const frame = data as Record<string, unknown>
      if (frame.type === "message_start") {
        const message = frame.message as Record<string, unknown> | undefined
        this.usage = usageOf(message?.usage, this.usage)
      } else if (frame.type === "message_delta") {
        this.usage = usageOf(frame.usage, this.usage)
      }
    }
  }
}
