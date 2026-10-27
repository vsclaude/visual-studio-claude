/**
 * What a request cost, read off the provider's own answer (DeepSeek's, in
 * Anthropic's shape) — what it takes off the user's credits.
 *
 * A credit is a ten-millionth of a dollar of **DeepSeek's list price**, and a
 * request costs its tokens at that price (`PRICES`). The unit is never shown
 * as a count: the studio and every page here write a balance, a pack or a
 * charge as **dollars** (`CREDITS_PER_USD`), and only the database, the
 * webhooks and the `usage` log line carry the integer.
 *
 * It was one Haiku input token at Anthropic's price, with every other kind of
 * token and model weighted against it; the integer is the same size, so a
 * balance converted once (`scripts/deepseek-credits.sql`) reads on as before.
 */

/** Ten million of the unit are $1.00 of DeepSeek's list price. Kept in step
 * with the app's `src/shared/credits.ts` by hand. */
export const CREDITS_PER_USD = 10_000_000

/** `$8.63`, `$0.135`, `$0.005` — as the studio's own `formatCredits`: cents
 * from a dollar up, a third place under it so a Haiku turn is neither doubled
 * to a cent nor shown as free, and that place dropped where it is a zero. */
export function formatCredits(credits: number): string {
  const dollars = Math.max(0, credits / CREDITS_PER_USD)
  if (dollars >= 1) {
    return `$${dollars.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  const three = dollars.toFixed(3)
  return `$${three.endsWith("0") ? three.slice(0, -1) : three}`
}

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
 * DeepSeek's prices, dollars per million tokens, at the **peak** rate
 * (api-docs.deepseek.com/quick_start/pricing, read 2026-10-27). Off-peak is
 * half, and charging peak all day is deliberate: the clock a request ran by
 * is DeepSeek's to decide, and a credit charged at the lower rate in the
 * wrong hour is a loss, where the other way is margin.
 *
 * A cache write has no price of its own there — a prompt not read from the
 * cache is a miss — so it is charged as one. There is no long-prompt rate.
 */
type ModelPrice = { input: number; cacheRead: number; output: number }

const FLASH: ModelPrice = { input: 0.3, cacheRead: 0.006, output: 1.2 }
const PRO: ModelPrice = { input: 1.32, cacheRead: 0.044, output: 3.96 }

/**
 * The price of the model DeepSeek will answer on. It answers a `claude-opus*`
 * name on V4 Pro and every other `claude-*` on Flash, so a model the CLI asks
 * for on its own is charged as what it ran on. Anything else is at the dearest
 * price: a model this table has not learnt is overcharged, not given away.
 */
function priceOf(model: string): ModelPrice {
  if (/pro|opus/i.test(model)) return PRO
  if (/flash|^claude-/i.test(model)) return FLASH
  return PRO
}

export function weighted(usage: Usage, model: string): number {
  const price = priceOf(model)
  const dollarsPerMillion =
    (usage.input_tokens + usage.cache_creation_input_tokens) * price.input +
    usage.cache_read_input_tokens * price.cacheRead +
    usage.output_tokens * price.output
  // Rounded before the ceiling: a flash token is 3.0000000000000004 credits
  // in floating point, and every request would be a credit dearer for it.
  return Math.ceil(
    Number(((dollarsPerMillion * CREDITS_PER_USD) / 1_000_000).toFixed(6))
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
