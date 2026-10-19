import {
  creditsArrived,
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

finish()
