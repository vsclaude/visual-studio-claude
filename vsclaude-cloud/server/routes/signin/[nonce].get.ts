import { defineHandler } from "nitro"

import { isNonce, signInPage } from "../../utils/signin.ts"

/**
 * `GET /signin/<nonce>` — the page the studio opens in the user's browser to
 * sign in with Google (`server/utils/signin.ts`). No token: signing in is how
 * one is got.
 */
export default defineHandler((event) => {
  const nonce = String(event.context.params?.nonce ?? "")
  if (!isNonce(nonce)) {
    return new Response("Start signing in from Visual Studio Claude.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }
  return new Response(signInPage(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // The nonce is in this page's URL; nothing it loads needs to be told it.
      "referrer-policy": "no-referrer",
    },
  })
})
