import {
  creditsArrived,
  creditsLeft,
  creditsOf,
  formatCredits,
  packsFor,
  type StudioAccount,
} from "../src/shared/credits"
import { check, finish, section } from "./harness"

/**
 * When the credits dialog says a purchase has landed (`creditsArrived`).
 *
 * Worth a test because both ways of getting it wrong are visible to somebody
 * who just paid: a celebration that never comes is money that seems to have
 * gone nowhere, and one on every launch is a balance celebrated for existing.
 */

const account = (credits: number): StudioAccount => ({
  models: ["deepseek-flash"],
  credits,
  creditsUsed: 0,
})

section("creditsArrived")
check(
  "a pack landing is what it added",
  creditsArrived(account(500), account(3_300_500)) === 3_300_000
)
check(
  "the first read after a launch or a sign-in is not an arrival",
  creditsArrived(null, account(3_300_000)) === 0
)
check("signing out is not an arrival", creditsArrived(account(10), null) === 0)
check(
  "spending is not one",
  creditsArrived(account(1_000_000), account(999_000)) === 0
)
check(
  "nothing changing is not one",
  creditsArrived(account(5), account(5)) === 0
)

// Written as dollars: ten million of the unit are $1.00. The cases are the
// figures that are actually drawn — a pack, a balance, a turn on each model —
// and the two ways rounding could lie about a turn: a Haiku turn shown as
// twice itself, or as free.
section("formatCredits")
check("a pack is its dollars", formatCredits(10_000_000) === "$1.00")
check("a balance has cents", formatCredits(86_281_913) === "$8.63")
check(
  "and thousands are grouped",
  formatCredits(12_345_678_900) === "$1,234.57"
)
check("an Opus turn keeps a third place", formatCredits(1_349_320) === "$0.135")
check(
  "a Haiku turn is not rounded to a cent",
  formatCredits(48_759) === "$0.005"
)
check("a dime drops the trailing zero", formatCredits(1_000_000) === "$0.10")
check("nothing is $0.00", formatCredits(0) === "$0.00")
check("and an overdraft is not negative", formatCredits(-50) === "$0.00")

// The 20.000 ₫ pack is a bank transfer's alone: Paddle's fixed fee is most of
// it, and the server refuses a card checkout for it.
section("packsFor")
check(
  "a transfer buys all four",
  packsFor("bank")
    .map((pack) => `${pack.price}:${formatCredits(pack.credits)}`)
    .join() === "20000:$0.667,50000:$1.67,100000:$3.67,200000:$8.00"
)
check(
  "a card buys from 50.000 ₫ up",
  packsFor("card")
    .map((pack) => pack.price)
    .join() === "50000,100000,200000"
)

section("creditsLeft")
const spent = (credits: number, creditsUsed: number): StudioAccount => ({
  ...account(credits),
  creditsUsed,
})
check(
  "the share left of everything bought",
  creditsLeft(spent(750, 250)).share === 0.75
)
check("plenty is not low", !creditsLeft(spent(750, 250)).low)
check("a tenth left is low", creditsLeft(spent(100, 900)).low)
check(
  "nothing left is low, and empty",
  creditsLeft(spent(0, 1000)).low && creditsLeft(spent(0, 1000)).share === 0
)
check(
  "an account that never had any is empty rather than NaN",
  creditsLeft(spent(0, 0)).share === 0
)
check(
  "a server too old to count spending reads as full",
  creditsLeft(spent(500, 0)).share === 1
)
check(
  "an overdraft below zero is still empty, not negative",
  creditsLeft(spent(-20, 1020)).share === 0
)

// The same arithmetic as the server's `weighted`, checked against the line
// its README quotes: in=12 out=180 cache_read=21000 → weighted=3456 on Flash.
// A credit is $0.0000001, so a token at $X/MTok is 10·X credits.
section("creditsOf")
const tokens = (over: Partial<Parameters<typeof creditsOf>[0]> = {}) => ({
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  ...over,
})
check(
  "the server's own example on Flash",
  creditsOf(
    tokens({ input: 12, output: 180, cacheRead: 21_000 }),
    "deepseek-flash"
  ) === 3_456
)
check(
  "a cache write is a miss, at full price",
  creditsOf(tokens({ cacheWrite: 1_000 }), "deepseek-flash") === 3_000
)
check(
  "V4 Pro at its own price",
  creditsOf(
    tokens({ input: 1_000, cacheRead: 20_000, output: 1_000 }),
    "deepseek-v4-pro"
  ) ===
    13_200 + 8_800 + 39_600
)
check(
  "a Claude name is priced as what DeepSeek answers it on",
  creditsOf(tokens({ input: 100 }), "claude-opus-5-5") === 1_320 &&
    creditsOf(tokens({ input: 100 }), "claude-sonnet-5-5") === 300
)
check(
  "a model nobody priced is charged as V4 Pro, not given away",
  creditsOf(tokens({ input: 100 }), "deepseek-v5") === 1_320
)
check(
  "rounded up, never down",
  creditsOf(tokens({ cacheRead: 1 }), "deepseek-flash") === 1
)

finish()
