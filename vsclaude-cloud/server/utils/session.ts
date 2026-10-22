import { errors, jwtVerify, SignJWT, type JWTPayload } from "jose"

/**
 * Who a request is from: tokens this server signs itself, with
 * `NITRO_SESSION_SECRET`, once Google has said who somebody is
 * (`google.ts`). Nothing else is asked — no Firebase, no identity service — so
 * the users, what they paid and who they are all live in this server's D1.
 *
 * Two kinds, told apart by audience so neither passes for the other:
 *
 * - a **session** token, ninety days, which the studio keeps the way Firebase
 *   kept its refresh token and spends on nothing but `POST /api/session`;
 * - an **access** token, an hour, which that answers with and which every other
 *   request carries. It is the one written to a file for the CLI's
 *   `apiKeyHelper`, so it is the one that has to stop working soon.
 */

const ISSUER = "vsclaude"
const SESSION_AUDIENCE = "vsclaude:session"
const ACCESS_AUDIENCE = "vsclaude:access"

export const SESSION_TTL_S = 90 * 24 * 3600
export const ACCESS_TTL_S = 3600

/**
 * Five minutes either way. The CLI caches the token it was handed for up to
 * five minutes (`CLAUDE_CODE_API_KEY_HELPER_TTL_MS` in the studio), so a
 * request at the edge can carry a token a moment past `exp` through nobody's
 * fault.
 */
const CLOCK_TOLERANCE_S = 5 * 60

export type User = {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

/** A token's user, or why it is not one — the reason goes into the log and
 * the refusal both. */
export type Verified = { ok: true; user: User } | { ok: false; reason: string }

function keyOf(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

function sign(
  user: User,
  audience: string,
  ttlS: number,
  secret: string,
  now: number
): Promise<string> {
  return new SignJWT({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    picture: user.picture ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setSubject(user.uid)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlS)
    .sign(keyOf(secret))
}

/** A session for somebody Google has just vouched for. */
export function signSession(
  user: User,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<string> {
  return sign(user, SESSION_AUDIENCE, SESSION_TTL_S, secret, now)
}

/** An hour's access for the holder of a live session. */
export function signAccess(
  user: User,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<string> {
  return sign(user, ACCESS_AUDIENCE, ACCESS_TTL_S, secret, now)
}

export function verifySession(token: string, secret: string) {
  return verify(token, SESSION_AUDIENCE, secret)
}

export function verifyAccess(token: string, secret: string) {
  return verify(token, ACCESS_AUDIENCE, secret)
}

async function verify(
  token: string,
  audience: string,
  secret: string
): Promise<Verified> {
  if (!secret) return { ok: false, reason: "the server has no session secret" }
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(token, keyOf(secret), {
      issuer: ISSUER,
      audience,
      algorithms: ["HS256"],
      clockTolerance: CLOCK_TOLERANCE_S,
    }))
  } catch (error) {
    return { ok: false, reason: reasonOf(error) }
  }
  if (typeof payload.sub !== "string" || payload.sub === "") {
    return { ok: false, reason: "the token names no user" }
  }
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null
  return {
    ok: true,
    user: {
      uid: payload.sub,
      email: text(payload.email),
      name: text(payload.name),
      picture: text(payload.picture),
    },
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof errors.JWTExpired) return "the token has expired"
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === "aud") return "the token is not for this use"
    if (error.claim === "iat" || error.claim === "nbf") {
      return "the token was issued in the future — the server's clock is wrong"
    }
    return `the token's ${error.claim} claim is invalid`
  }
  if (
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JOSEAlgNotAllowed
  ) {
    return "the token is not signed by this server"
  }
  if (error instanceof errors.JOSEError) {
    return "the token is not a Vey Studio sign-in"
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * The token out of a request: `Authorization: Bearer …` or `x-api-key`. The
 * studio's `claude` sends both (an `apiKeyHelper`'s output goes out as each),
 * and either alone is enough.
 */
export function tokenOf(headers: Headers): string | null {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  const token = bearer ?? headers.get("x-api-key")
  return token?.trim() || null
}
