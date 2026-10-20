import {
  creditsArrived,
  creditsLeft,
  creditsOf,
  formatCredits,
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
  models: ["claude-haiku-5-5"],
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

section("formatCredits")
check("millions, one decimal", formatCredits(3_300_000) === "3.3M")
check("a whole million, no decimal", formatCredits(1_000_000) === "1M")
check("under a million, grouped", formatCredits(250_000) === "250,000")

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
// its README quotes: in=12 out=180 cache_read=21000 → weighted=3012 on Haiku.
section("creditsOf")
const tokens = (over: Partial<Parameters<typeof creditsOf>[0]> = {}) => ({
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  ...over,
})
check(
  "the server's own example on Haiku",
  creditsOf(
    tokens({ input: 12, output: 180, cacheRead: 21_000 }),
    "claude-haiku-5-5"
  ) === 3_012
)
check(
  "a cache write is a quarter over full price",
  creditsOf(tokens({ cacheWrite: 1_000 }), "claude-haiku-5-5") === 1_250
)
check(
  "Sonnet is twenty times Haiku, with cache reads at a twentieth",
  creditsOf(
    tokens({ input: 1_000, cacheRead: 20_000, output: 1_000 }),
    "claude-sonnet-5-5"
  ) ===
    (1_000 + 20_000 * 0.05 + 1_000 * 5) * 20
)
check(
  "Opus is forty times",
  creditsOf(tokens({ input: 100 }), "claude-opus-5-5") === 4_000
)
check(
  "a model nobody priced is charged as Opus, not given away",
  creditsOf(tokens({ input: 100 }), "claude-fable-5-1") === 4_000
)
check(
  "rounded up, never down",
  creditsOf(tokens({ cacheRead: 1 }), "claude-haiku-5-5") === 1
)

finish()
