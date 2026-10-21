import { useRuntimeConfig } from "nitro/runtime-config"

import type { CreditItem } from "./billing.ts"
import { catalogOf, type Catalog } from "./paddle-billing.ts"

/**
 * This server's Paddle: which of its two systems, the key, and the price ids.
 *
 * Sandbox and live are separate accounts — separate keys, products, price ids,
 * webhook secrets and client tokens — so everything here moves together when
 * `NITRO_PADDLE_ENVIRONMENT` does.
 */

export function paddleConfig() {
  const config = useRuntimeConfig()
  const sandbox = String(config.paddleEnvironment) !== "production"
  // No `credits-mini`: it is sold by bank transfer only (`bankOnly`).
  const prices: Partial<Record<CreditItem, string>> = {
    "credits-20k": String(config.paddlePriceCredits20k),
    "credits-60k": String(config.paddlePriceCredits60k),
    "credits-100k": String(config.paddlePriceCredits100k),
  }
  return {
    sandbox,
    apiBase: sandbox
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com",
    apiKey: String(config.paddleApiKey),
    webhookSecret: String(config.paddleWebhookSecret),
    clientToken: String(config.paddleClientToken),
    prices,
    catalog: catalogOf(prices) satisfies Catalog,
  }
}

/** A call to Paddle's API, answered as its JSON — or null with the reason, for
 * the request's log line. A `body` of `undefined` is a GET. */
export async function paddleApi(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  return paddleCall(body === undefined ? "GET" : "POST", path, body, signal)
}

/**
 * The Paddle customer for an email, made if Paddle has none. A transaction
 * that names it is checked out with that email already filled in — the
 * checkout does not ask for it again — and the uid rides on the customer as
 * well, for whoever reads Paddle's side.
 */
export async function paddleCustomerOf(
  email: string,
  uid: string,
  signal?: AbortSignal
): Promise<string | null> {
  // A list, not an object: `data` is the array of matches, newest first.
  const found = await paddleCall(
    "GET",
    `/customers?email=${encodeURIComponent(email)}`,
    undefined,
    signal
  )
  const matches = found.ok
    ? (found.data as unknown as Array<{ id?: unknown }>)
    : []
  if (typeof matches[0]?.id === "string") return matches[0].id
  const made = await paddleApi(
    "/customers",
    { email, custom_data: { uid } },
    signal
  )
  return made.ok && typeof made.data.id === "string" ? made.data.id : null
}

async function paddleCall(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  const { apiBase, apiKey } = paddleConfig()
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    return { ok: false, error: `Paddle unreachable: ${String(error)}` }
  }
  const answer = (await response.json().catch(() => null)) as {
    data?: Record<string, unknown>
  } | null
  if (!response.ok || !answer?.data) {
    return {
      ok: false,
      error: `${response.status} ${JSON.stringify(answer).slice(0, 300)}`,
    }
  }
  return { ok: true, data: answer.data }
}
