import { defineHandler } from "nitro"

import { authorizeUrl, googleConfig } from "../../utils/google.ts"
import { noteRequest } from "../../utils/log.ts"
import { publicUrlOf } from "../../utils/sepay.ts"
import { isNonce, signInPage } from "../../utils/signin.ts"

/**
 * `GET /signin/<nonce>` — opened in the user's browser by the studio to sign in
 * with Google (`server/utils/signin.ts`). It goes straight to Google: the
 * browser is redirected there, with the nonce as `state`. No token: signing in
 * is how one is got.
 */
export default defineHandler((event) => {
  const nonce = String(event.context.params?.nonce ?? "")
  if (!isNonce(nonce)) {
    return new Response("Start signing in from VS Claude.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  const google = googleConfig()
  if (!google.clientId || !google.clientSecret) {
    noteRequest(event, { refused: "no Google client configured" })
    return new Response(
      signInPage({
        kind: "failed",
        reason:
          "This server cannot sign anybody in yet: it has no Google client (NITRO_GOOGLE_CLIENT_ID / NITRO_GOOGLE_CLIENT_SECRET).",
      }),
      {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      }
    )
  }

  const callback = `${publicUrlOf(event)}/signin/callback`
  // Google refuses one that is not among the client's redirect URIs
  // character for character (`redirect_uri_mismatch`); this is the one to add.
  noteRequest(event, { redirect_uri: callback })
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(google.clientId, callback, nonce, false),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  })
})
