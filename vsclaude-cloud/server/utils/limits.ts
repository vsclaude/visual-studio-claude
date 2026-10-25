import { getAccount } from "./accounts.ts"
import type { Account } from "./billing.ts"

/**
 * The models offered — what `/v1/models` lists and `/api/usage` names, the
 * app's `FREE_AI_MODELS`. Offered, not enforced: a request on any other model
 * is passed on too and charged at its family's price (`usage.ts`). This was
 * `NITRO_ALLOWED_MODELS`, and a refusal for everything off it.
 */
export const MODELS = [
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
]

/** What a user may do: the models offered, and the account holding the
 * credits every request is paid for out of. */
export type Limits = {
  models: string[]
  account: Account
}

export async function limitsOf(uid: string): Promise<Limits> {
  return { models: MODELS, account: await getAccount(uid) }
}
