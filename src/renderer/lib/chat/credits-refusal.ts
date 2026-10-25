/**
 * Whether a failed turn failed for want of credits — and so should be drawn
 * as a way to buy some rather than as one more red line.
 *
 * Read off the sentence because that is all that reaches the transcript: the
 * server refuses with an Anthropic-shaped 400 (`vsclaude-cloud`'s
 * `/v1/messages`), the CLI folds it into its result text as `API Error: 400
 * {…}`, and `chat.ts` writes that down as an `error` line. A 400 rather than a
 * 402 is deliberate on the server's side — the CLI retries a 403 for minutes —
 * so the status says nothing and the words are the signal. Matched loosely,
 * since the CLI is free to wrap them in JSON, escape them or prefix them.
 *
 * `signed-out` is this app's own refusal (`Chats.send`), sent before the CLI
 * is ever asked — and so is `no-credits`, when the balance was last seen
 * empty (`outOfCredits` in `main/free-ai.ts`), in the server's own sentence.
 */
export type CreditsRefusal = "no-credits" | "signed-out"

export function creditsRefusalOf(text: string): CreditsRefusal | null {
  if (/no credits left/i.test(text)) return "no-credits"
  // Every name and wording the refusal has had stays matched, because a
  // transcript keeps the sentence it was written with: "Visual Studio Claude"
  // and then "VS Claude" before the app was Vey Studio, and "the Studio AI"
  // before credits had that name.
  if (
    /sign in to (vey studio|vs claude|visual studio claude) to (pay with credits|use the studio ai)/i.test(
      text
    )
  ) {
    return "signed-out"
  }
  return null
}
