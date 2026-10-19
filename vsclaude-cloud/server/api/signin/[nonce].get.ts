import { defineHandler } from "nitro"

import { isNonce, takeAnswer } from "../../utils/signin.ts"

/**
 * `GET /api/signin/<nonce>` — the sign-in page's answer, for the studio to
 * poll: `204` while there is none, then the answer once, removed as it is
 * read. No token; the nonce is the studio's own secret.
 */
export default defineHandler(async (event) => {
  const nonce = String(event.context.params?.nonce ?? "")
  if (!isNonce(nonce)) {
    return Response.json({ error: "No such sign-in." }, { status: 404 })
  }
  const answer = await takeAnswer(nonce)
  if (!answer) {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    })
  }
  return Response.json(answer, { headers: { "cache-control": "no-store" } })
})
