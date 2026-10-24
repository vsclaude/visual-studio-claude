/**
 * What the free AI (`shared/free-ai.ts`) sells: credit packs.
 *
 * Also the shapes the server's account calls answer with (`StudioAccount`),
 * since main fetches them and the renderer draws them.
 *
 * **The copy, not the rules.** The server (`vsclaude-cloud`, `billing.ts`)
 * decides what credits pay for and sells them two ways (`PaymentMethod`): by
 * **bank transfer** through SePay and by **card** through Paddle. This table is
 * what the credits dialog draws; the ids are what a purchase is asked for, and
 * the server maps a card one to Paddle's price ids, which are its
 * configuration.
 *
 * Prices are in **Vietnamese đồng** and must match the server's `CREDIT_PACKS`
 * and the prices set in Paddle — or the dialog promises a price the checkout
 * does not charge.
 *
 * There were monthly plans here once — Starter, Plus and Pro — and they are
 * withdrawn: `docs/design.md` § Plans, removed.
 */

/**
 * **A credit is a ten-millionth of a dollar** of Anthropic's list price, so a
 * balance of ten million is $1.00 of API usage — and that is how every balance,
 * pack and charge is **written**: `$1.00`, never `10M credits`.
 *
 * The unit itself is the server's (`usage.ts` there): one Haiku input token,
 * with every other kind of token and every other model weighted by its price.
 * The number stayed and the words changed, because a figure that looks like a
 * token count is read as one: a 67-token answer on Opus charged `1.3M credits`
 * read as the app miscounting by a factor of forty, where `$0.13` beside
 * `33.4k prompt` says what happened. The balance in D1, the charge on every
 * usage line and the packs' sizes are all still in the integer unit — a dollar
 * figure would lose a Haiku request's $0.0003 to rounding — and only the
 * formatting knows the rate.
 */
export const CREDITS_PER_USD = 10_000_000

/** A pack's size written as the dollars it is, in the integer unit. */
function usd(dollars: number): number {
  return Math.round(dollars * CREDITS_PER_USD)
}

export type CreditPack = {
  id: "credits-mini" | "credits-20k" | "credits-60k" | "credits-100k"
  /**
   * Sold by bank transfer alone, and not offered while the dialog is on card:
   * on 20.000 ₫ Paddle's fixed $0.50 is most of the price, and Paddle charges
   * no less than 20.276 ₫ anyway. The server refuses a card checkout for it.
   */
  bankOnly?: boolean
  /** Once, in VND. */
  price: number
  /** What it adds, in the integer unit — `CREDITS_PER_USD` to the dollar. */
  credits: number
  /** A bonus over the base rate, in percent — drawn as a badge. */
  bonus?: number
  /**
   * The pack the dialog steers toward — raised, ringed and given the filled
   * button. One at most: two highlights are no highlight.
   */
  popular?: boolean
}

/**
 * Credits, which every Studio AI request is paid for out of, on any model —
 * they do not expire.
 *
 * $1.00 of usage per 2.000 ₫, plus the bonus the bigger packs are badged
 * with: 100.000 ₫ is $50 and 10% more, 200.000 ₫ is $100 and 20% more, so
 * the badge and the number say the same thing. Four amounts, the ones a
 * Vietnamese transfer is made in; the 20.000 ₫ one is `bankOnly`. Why that rate, and why nothing
 * under 50.000 ₫, is the server's `billing.ts`. The ids name an earlier
 * table's prices and stay: they are the server's item names
 * (`NITRO_PADDLE_PRICE_CREDITS20K`), which renaming would break. The same
 * price by bank transfer, so the pack has one price whichever way it is paid.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-mini", price: 20_000, credits: usd(10), bankOnly: true },
  { id: "credits-20k", price: 50_000, credits: usd(25) },
  {
    id: "credits-60k",
    price: 100_000,
    credits: usd(55),
    bonus: 10,
    popular: true,
  },
  {
    id: "credits-100k",
    price: 200_000,
    credits: usd(120),
    bonus: 20,
  },
]

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

/** A price as the checkout will show it — `50.000 ₫`. */
export function formatPrice(price: number): string {
  return VND.format(price)
}

/**
 * How a purchase is paid. `bank` is a VietQR transfer through SePay — no card
 * and no fee to speak of. `card` is Paddle, for anybody outside Vietnam.
 */
export type PaymentMethod = "bank" | "card"

/**
 * Whether the credits dialog offers the card side at all. Off for now: every
 * purchase is by bank transfer and the dialog has no switch to a card. The
 * server's card checkout and the card packs are left as they are, so turning
 * this back on brings the side back unchanged.
 */
export const CARD_OFFERED = false

/**
 * The signed-in user's credits on the server, `GET /api/usage` there, in the
 * integer unit (`CREDITS_PER_USD`). Every Studio AI request is paid for out of
 * them; there is no free allowance.
 */
export type StudioAccount = {
  /** The models the server runs. */
  models: string[]
  /** Left to spend. */
  credits: number
  /** Spent so far, ever — 0 from a server too old to count it. */
  creditsUsed: number
}

/**
 * How many credits arrived between two reads of the account, or 0.
 *
 * Nothing on a first read — `before` is null after a launch or a sign-in, and
 * a balance seen for the first time is not one that just went up. A drop is
 * spending, or a refund, and is not an arrival either.
 */
export function creditsArrived(
  before: StudioAccount | null,
  after: StudioAccount | null
): number {
  if (!before || !after) return 0
  return Math.max(0, after.credits - before.credits)
}

/**
 * How much of everything bought is left, for the bars that empty as it is
 * spent — and whether that is little enough to say so.
 *
 * All-time, because `credits` and `creditsUsed` are the only two numbers the
 * server hands over and a pack has no end date to measure a month against. A
 * tenth is where a balance stops being something to forget about; nothing at
 * all is `low` too, so a bar at zero is never drawn in the calm colours.
 */
export function creditsLeft(account: StudioAccount): {
  share: number
  low: boolean
} {
  const total = account.credits + account.creditsUsed
  const share = total > 0 ? Math.max(0, account.credits) / total : 0
  return { share, low: share <= 0.1 }
}

/**
 * What a turn's tokens come to in credits, the way the server charges them.
 *
 * A credit is one Haiku input token's worth, a ten-millionth of a dollar:
 * every kind of token is weighted by its price against that — cache writes
 * 1.25×, output 5×, cache reads 0.1× on Haiku and 0.05× on Sonnet and Opus —
 * and the whole is multiplied by the model's price against Haiku's, 20× for
 * Sonnet and 40× for Opus. Anything not recognised is Opus, the dearest, as
 * the server has it. The result is written as dollars (`formatCredits`).
 *
 * **A copy of `weighted` in `vsclaude-cloud/server/utils/usage.ts`, kept in
 * step by hand** — the two packages share no code, and a figure on the row
 * that disagrees with what came off the balance is worse than no figure. Two
 * ways it can still differ, both small: the server rounds up per request and
 * this per turn, and Haiku's long-prompt price is charged per request where
 * this sees only the turn's sum — a case the server refuses before it costs
 * anything, so it is left out here rather than guessed at.
 */
export function creditsOf(
  usage: {
    input: number
    cacheWrite: number
    cacheRead: number
    output: number
  },
  model: string
): number {
  const haiku = /haiku/i.test(model)
  const factor = haiku ? 1 : /sonnet/i.test(model) ? 20 : 40
  const cacheRead = haiku ? 0.1 : 0.05
  return Math.ceil(
    (usage.input +
      usage.cacheWrite * 1.25 +
      usage.cacheRead * cacheRead +
      usage.output * 5) *
      factor
  )
}

/** The packs a way of paying can buy — every one by transfer, all but the
 * `bankOnly` ones by card. */
export function packsFor(method: PaymentMethod): CreditPack[] {
  return CREDIT_PACKS.filter((pack) => method === "bank" || !pack.bankOnly)
}

/** What `credits` are in dollars — the one place the rate is applied. */
export function usdOf(credits: number): number {
  return credits / CREDITS_PER_USD
}

/**
 * `$8.63`, `$0.135`, `$0.005` — a balance, a pack or a charge as every dialog
 * and usage line writes it.
 *
 * Cents from a dollar up, since that is how a balance is read. Under a dollar
 * a third place stays, because that is where a turn lives: a short Opus turn
 * is $0.135 and a Haiku one $0.005, and two places would make the second one
 * `$0.01` — twice what it was — or `$0.00`, a turn the app claims was free.
 * The third place is dropped again where it is a zero, so a dime is `$0.10`.
 */
export function formatCredits(credits: number): string {
  const dollars = Math.max(0, usdOf(credits))
  if (dollars >= 1) {
    return `$${dollars.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  const three = dollars.toFixed(3)
  return `$${three.endsWith("0") ? three.slice(0, -1) : three}`
}

/** What a buy click came to: a browser opened, or why not. */
export type PurchaseResult = { ok: true } | { ok: false; error: string }
