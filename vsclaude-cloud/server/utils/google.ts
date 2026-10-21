import { decodeJwt } from "jose"
import { useRuntimeConfig } from "nitro/runtime-config"

import type { User } from "./session.ts"

/**
 * Google sign-in as an OAuth client of this server's own — a **Web
 * application** client in Google Cloud › APIs & Services › Credentials, its id
 * and secret in `NITRO_GOOGLE_CLIENT_ID` / `NITRO_GOOGLE_CLIENT_SECRET`, with
 * `https://<server>/signin/callback` (and `http://localhost:3000/signin/callback`
 * for `bun run dev`) among its authorized redirect URIs.
 *
 * The authorization-code flow, server side: the browser is sent to Google with
 * the sign-in's nonce as `state`, comes back to `/signin/callback` with a code,
 * and the code is exchanged here, with the secret, for Google's ID token.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN = "https://oauth2.googleapis.com/token"
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

export type GoogleConfig = { clientId: string; clientSecret: string }

export function googleConfig(): GoogleConfig {
  const config = useRuntimeConfig()
  return {
    clientId: String(config.googleClientId),
    clientSecret: String(config.googleClientSecret),
  }
}

/** Where the browser goes to sign in. Without `prompt` somebody already
 * signed in to Google with one account, who has said yes before, is sent
 * straight back; `chooseAccount` is the page's link for picking another. */
export function authorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  chooseAccount: boolean
): string {
  const url = new URL(AUTHORIZE)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email profile")
  url.searchParams.set("state", state)
  if (chooseAccount) url.searchParams.set("prompt", "select_account")
  return url.toString()
}

/**
 * The user Google's ID token names, or why it does not name one.
 *
 * The token came straight from Google's token endpoint over TLS, in answer to
 * this client's own secret, so Google's documentation lets its signature go
 * unchecked; what is checked is that it was minted for this client.
 */
export function userOfIdToken(
  idToken: string,
  clientId: string
): User | string {
  let claims: Record<string, unknown>
  try {
    claims = decodeJwt(idToken)
  } catch {
    return "Google's answer held no ID token"
  }
  if (claims.aud !== clientId) return "Google's ID token is for another client"
  if (!ISSUERS.includes(String(claims.iss))) {
    return "Google's ID token was not issued by Google"
  }
  if (typeof claims.sub !== "string" || !claims.sub) {
    return "Google's ID token names nobody"
  }
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null
  return {
    // Prefixed so a second way of signing in, if there is ever one, cannot
    // collide with Google's numbering.
    uid: `google:${claims.sub}`,
    email: claims.email_verified === false ? null : text(claims.email),
    name: text(claims.name),
    picture: text(claims.picture),
  }
}

/** Exchanges the callback's code for the user it signed in, or the reason. */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  google: GoogleConfig,
  fetcher: typeof fetch = fetch
): Promise<User | string> {
  let response: Response
  try {
    response = await fetcher(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
  } catch (error) {
    return `Google could not be reached: ${error instanceof Error ? error.message : String(error)}`
  }
  const answer = (await response.json().catch(() => null)) as {
    id_token?: unknown
    error?: unknown
    error_description?: unknown
  } | null
  if (!response.ok || typeof answer?.id_token !== "string") {
    const why = answer?.error_description ?? answer?.error ?? response.status
    return `Google refused the sign-in: ${String(why)}`
  }
  return userOfIdToken(answer.id_token, google.clientId)
}
