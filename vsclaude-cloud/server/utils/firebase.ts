import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose"

/**
 * Who a request is from: the Firebase ID token the studio sends with it.
 *
 * Verified against Google's published keys rather than through
 * `firebase-admin`: an ID token is a JWT signed by `securetoken`, and checking
 * one needs the project id and the public keys — no service account, no SDK
 * that pulls in half of Google Cloud. The checks are the ones Firebase
 * documents for verifying an ID token with a third-party JWT library.
 */

export const GOOGLE_JWKS =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

const remoteKeys = new Map<string, JWTVerifyGetKey>()

/** A key set fetched on first use and cached by `jose` per its headers —
 * Google's, unless the server is configured with another for a test. */
export function keysAt(url: string): JWTVerifyGetKey {
  let keys = remoteKeys.get(url)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(url))
    remoteKeys.set(url, keys)
  }
  return keys
}

export type FirebaseUser = { uid: string; email: string | null }

/** A token's user, or why it is not one — the reason goes into the log and
 * the refusal both, since "expired" and "this server's clock is wrong" are
 * fixed by different people. */
export type Verified =
  { ok: true; user: FirebaseUser } | { ok: false; reason: string }

/**
 * Five minutes either way. The CLI caches the token it was handed for up to
 * five minutes (`CLAUDE_CODE_API_KEY_HELPER_TTL_MS` in the studio) and Firebase
 * refreshes one about five minutes before it lapses, so a request at the edge
 * can carry a token a moment past `exp` through nobody's fault.
 */
const CLOCK_TOLERANCE_S = 5 * 60

/**
 * The user a token belongs to, or why it is not a live ID token of this
 * project — expired, signed by anything else, or minted for another app.
 *
 * `keys` is Google's unless a test signs its own.
 */
export async function verifyIdToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = keysAt(GOOGLE_JWKS)
): Promise<Verified> {
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      clockTolerance: CLOCK_TOLERANCE_S,
    }))
  } catch (error) {
    return { ok: false, reason: reasonOf(error) }
  }
  // `sub` is the uid; Firebase guarantees it non-empty, and a token without
  // one is not a user this server can meter.
  if (typeof payload.sub !== "string" || payload.sub === "") {
    return { ok: false, reason: "the token names no user" }
  }
  const now = Date.now() / 1000
  for (const claim of ["iat", "auth_time"] as const) {
    const at = payload[claim]
    if (typeof at === "number" && at > now + CLOCK_TOLERANCE_S) {
      return { ok: false, reason: futureReason(at - now) }
    }
  }
  return {
    ok: true,
    user: {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    },
  }
}

/** Google minted the token, so a token from the future means the clock that
 * is wrong is this server's. */
function futureReason(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `the token was issued ${minutes} minutes in the future by this server's clock — the server's clock is wrong`
}

function reasonOf(error: unknown): string {
  if (error instanceof errors.JWTExpired) return "the token has expired"
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === "iss" || error.claim === "aud") {
      return "the token is for another Firebase project"
    }
    if (error.claim === "iat" || error.claim === "nbf") {
      const at = Number(error.payload[error.claim])
      return futureReason(at - Date.now() / 1000)
    }
    return `the token's ${error.claim} claim is invalid`
  }
  if (
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JWKSNoMatchingKey ||
    error instanceof errors.JOSEAlgNotAllowed
  ) {
    return "the token is not signed by Firebase"
  }
  if (
    error instanceof errors.JWKSTimeout ||
    error instanceof errors.JWKSInvalid
  ) {
    return "Google's signing keys could not be fetched"
  }
  if (error instanceof errors.JOSEError) {
    return "the token is not a Firebase ID token"
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
