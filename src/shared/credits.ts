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
 * **A credit is a ten-millionth of a dollar** of DeepSeek's list price, so a
 * balance of ten million is $1.00 of API usage — and that is how every balance,
 * pack and charge is **written**: `$1.00`, never `10M credits`.
 *
 * The unit itself is the server's (`usage.ts` there). The number stayed and
 * the words changed, because a figure that looks like a token count is read as
 * one: a 67-token answer on Opus charged `1.3M credits` read as the app
 * miscounting by a factor of forty, where `$0.13` beside `33.4k prompt` says
 * what happened. The balance in D1, the charge on every usage line and the
 * packs' sizes are all still in the integer unit — a dollar figure would lose
 * a cached Flash request's $0.0001 to rounding — and only the formatting knows
 * the rate.
 */
export const CREDITS_PER_USD = 10_000_000

/**
 * What a dollar of usage sells for — the server's `VND_PER_USD`. DeepSeek is
 * paid at about 26.300 ₫ to the dollar, so this is some 15% over cost.
 */
export const VND_PER_USD = 30_000

/** What `price` buys at `VND_PER_USD`, plus `bonus` percent, in the integer
 * unit. */
function packOf(price: number, bonus = 0): number {
  return Math.round((price / VND_PER_USD) * (1 + bonus / 100) * CREDITS_PER_USD)
}

export type CreditPack = {
  id: "vnd-20k" | "vnd-50k" | "vnd-100k" | "vnd-200k"
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
 * $1.00 of usage per `VND_PER_USD`, plus the bonus the bigger packs are
 * badged with — the bonus is an argument of the size, so the badge and the
 * number cannot say different things. Four amounts, the ones a Vietnamese
 * transfer is made in; the 20.000 ₫ one is `bankOnly`. Why the rate is the
 * server's `billing.ts`. An id is its price, and is also the server's item
 * name.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "vnd-20k", price: 20_000, credits: packOf(20_000), bankOnly: true },
  { id: "vnd-50k", price: 50_000, credits: packOf(50_000) },
  {
    id: "vnd-100k",
    price: 100_000,
    credits: packOf(100_000, 10),
    bonus: 10,
    popular: true,
  },
  {
    id: "vnd-200k",
    price: 200_000,
    credits: packOf(200_000, 20),
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
 * DeepSeek's prices, dollars per million tokens, at the peak rate the server
 * charges all day. A cache write has no price of its own there and is a miss.
 */
const FLASH = { input: 0.3, cacheRead: 0.006, output: 1.2 }
const PRO = { input: 1.32, cacheRead: 0.044, output: 3.96 }

/**
 * What a turn's tokens come to in credits, the way the server charges them.
 *
 * Each kind of token at the model's price, a credit being a ten-millionth of
 * a dollar. DeepSeek answers a `claude-opus*` name on V4 Pro and any other
 * `claude-*` on Flash, so those are priced as what ran; anything not
 * recognised is V4 Pro, the dearest, as the server has it. The result is
 * written as dollars (`formatCredits`).
 *
 * **A copy of `weighted` in `vsclaude-cloud/server/utils/usage.ts`, kept in
 * step by hand** — the two packages share no code, and a figure on the row
 * that disagrees with what came off the balance is worse than no figure. The
 * one way it can still differ is small: the server rounds up per request and
 * this per turn.
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
  const price = /pro|opus/i.test(model)
    ? PRO
    : /flash|^claude-/i.test(model)
      ? FLASH
      : PRO
  const dollarsPerMillion =
    (usage.input + usage.cacheWrite) * price.input +
    usage.cacheRead * price.cacheRead +
    usage.output * price.output
  // Rounded before the ceiling, as the server does: a Flash token is
  // 3.0000000000000004 credits in floating point.
  return Math.ceil(
    Number(((dollarsPerMillion * CREDITS_PER_USD) / 1_000_000).toFixed(6))
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
