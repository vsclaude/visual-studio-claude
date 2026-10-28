/**
 * A JSON body's fields, or the 400 to answer with. Every route here that takes
 * a body takes a small flat object, and a body that is not one is the same
 * refusal everywhere.
 */
export async function fieldsOf(
  req: Request
): Promise<Record<string, unknown> | Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "The body is not JSON." }, { status: 400 })
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: "The body is not an object." },
      { status: 400 }
    )
  }
  return body as Record<string, unknown>
}

/** An email address as somebody typed it, trimmed and lower-cased — or null
 * for one with no `@` and dot after it. Not a validation of the mailbox:
 * the key mail is what finds out. */
export function emailOf(input: unknown): string | null {
  if (typeof input !== "string") return null
  const email = input.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null
}
