import { creditsRefusalOf } from "../src/renderer/lib/chat/credits-refusal"
import { check, finish, section } from "./harness"

/**
 * Which failed turns are drawn as a way to buy credits (`creditsRefusalOf`).
 *
 * Worth a test because the sentence is the only signal — the server's status
 * is an ordinary 400 — and both mistakes cost: a refusal drawn as a plain red
 * line hides the one button that fixes it, and an unrelated failure drawn as
 * "buy credits" asks for money about a problem money does not solve.
 */

section("creditsRefusalOf")
check(
  "the server's refusal, as the CLI wraps it",
  creditsRefusalOf(
    'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"You have no credits left. Buy credits from the account menu in Visual Studio Claude to keep going."}}'
  ) === "no-credits"
)
check(
  "the bare sentence",
  creditsRefusalOf("You have no credits left.") === "no-credits"
)
check(
  "this app's own refusal before sign-in",
  creditsRefusalOf("Sign in to Visual Studio Claude to pay with credits.") ===
    "signed-out"
)
check(
  "the same refusal written before the rename",
  creditsRefusalOf("Sign in to Visual Studio Claude to use the Studio AI.") ===
    "signed-out"
)
check(
  "a model the server does not run is not about credits",
  creditsRefusalOf("API Error: 400 This server runs claude-haiku-5-5 only.") ===
    null
)
check(
  "an ordinary failure is not about credits",
  creditsRefusalOf("Interrupted by user.") === null
)

finish()
