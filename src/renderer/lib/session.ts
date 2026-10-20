/**
 * The studio's session token as the renderer reads it — who it names and
 * whether it has lapsed. Pure, so `test/account-session.ts` can feed it.
 */

/** Only what Settings shows. */
export type Account = {
  email: string | null
  name: string | null
  photo: string | null
}

/**
 * The session's own claims, read without checking the signature: the server
 * checks it on every exchange, and all this decides is what Settings draws and
 * whether the session has lapsed. Null for anything that is not a live one.
 */
export function accountOfSession(
  session: string,
  now = Date.now()
): Account | null {
  const payload = session.split(".")[1]
  if (!payload) return null
  let claims: Record<string, unknown>
  try {
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const json = new TextDecoder().decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0))
    )
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== "object") return null
    claims = parsed as Record<string, unknown>
  } catch {
    return null
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null
  return {
    email: text(claims.email),
    name: text(claims.name),
    photo: text(claims.picture),
  }
}
