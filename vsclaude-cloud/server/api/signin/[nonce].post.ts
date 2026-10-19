import { defineHandler } from "nitro"

import { noteRequest } from "../../utils/log.ts"
import {
  isNonce,
  MAX_ANSWER_BYTES,
  parseAnswer,
  saveAnswer,
} from "../../utils/signin.ts"

/**
 * `POST /api/signin/<nonce>` `{ idToken } | { error }` — the sign-in page's
 * answer, kept for the studio to collect. No token: the page has a Google ID
 * token, not a Firebase one, and the nonce is what says the answer is wanted.
 *
 * The Google token is not checked here. It is Google's, for the Firebase
 * project's OAuth client, and the studio hands it straight to Firebase, which
 * is what checks it.
 */
export default defineHandler(async (event) => {
  const nonce = String(event.context.params?.nonce ?? "")
  if (!isNonce(nonce)) {
    return Response.json({ error: "No such sign-in." }, { status: 404 })
  }

  const body = await event.req.text()
  if (body.length > MAX_ANSWER_BYTES) {
    return Response.json({ error: "Too large." }, { status: 413 })
  }
  const answer = parseAnswer(body)
  if (!answer) {
    return Response.json({ error: "Not an answer." }, { status: 400 })
  }

  if (!(await saveAnswer(nonce, answer))) {
    noteRequest(event, { refused: "sign-in already answered" })
    return Response.json(
      { error: "This sign-in was already answered." },
      { status: 409 }
    )
  }
  return new Response(null, { status: 204 })
})
