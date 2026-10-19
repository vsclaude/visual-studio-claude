import { useRuntimeConfig } from "nitro/runtime-config"

import { listOf } from "./anthropic.ts"
import { getAccount } from "./accounts.ts"
import type { Account } from "./billing.ts"

/** What a user may do: the models served, and the account holding the
 * credits every request is paid for out of. */
export type Limits = {
  models: string[]
  account: Account
}

export async function limitsOf(uid: string): Promise<Limits> {
  return {
    models: listOf(String(useRuntimeConfig().allowedModels)),
    account: await getAccount(uid),
  }
}
