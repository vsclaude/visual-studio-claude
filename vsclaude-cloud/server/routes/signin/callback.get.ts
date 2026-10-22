import { defineHandler } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import { saveUser } from "../../utils/accounts.ts"
import { exchangeCode, googleConfig } from "../../utils/google.ts"
import { noteRequest } from "../../utils/log.ts"
import { signSession } from "../../utils/session.ts"
import { publicUrlOf } from "../../utils/sepay.ts"
import {
  isNonce,
  saveAnswer,
  signInPage,
  type SignInView,
} from "../../utils/signin.ts"

/**
 * `GET /signin/callback?code&state` — where Google sends the browser back
 * (`google.ts`). `state` is the sign-in's nonce. The code is exchanged for who
 * signed in, they are written to `users`, and a session token of this
 * server's own is left under the nonce for the studio to collect.
 *
 * A refusal — the user pressed Cancel at Google, the code was stale — is left
 * under the nonce too, so the studio stops waiting and says why.
 */
export default defineHandler(async (event) => {
  const params = event.url.searchParams
  const nonce = params.get("state") ?? ""
  if (!isNonce(nonce)) {
    noteRequest(event, { refused: "no sign-in in state" })
    return page({ kind: "failed", reason: "This is not a Vey Studio sign-in." })
  }

  const outcome = await signIn(params, publicUrlOf(event))
  if (typeof outcome === "string") {
    noteRequest(event, { refused: outcome })
    await saveAnswer(nonce, { error: outcome })
    return page({ kind: "failed", reason: outcome })
  }

  noteRequest(event, { uid: outcome.uid })
  if (!(await saveAnswer(nonce, { token: outcome.token }))) {
    noteRequest(event, { refused: "sign-in already answered" })
    return page({
      kind: "failed",
      reason: "This sign-in was already answered.",
    })
  }
  return page({ kind: "done" })
})

/** The session the callback's code is worth, or why there is none. */
async function signIn(
  params: URLSearchParams,
  origin: string
): Promise<{ uid: string; token: string } | string> {
  const refused = params.get("error")
  if (refused) {
    return refused === "access_denied"
      ? "Sign-in was cancelled at Google."
      : `Google refused the sign-in: ${refused}`
  }
  const code = params.get("code")
  if (!code) return "Google sent no sign-in back."

  const secret = String(useRuntimeConfig().sessionSecret)
  if (!secret) {
    return "This server cannot sign anybody in yet: it has no session secret (NITRO_SESSION_SECRET)."
  }
  const user = await exchangeCode(
    code,
    `${origin}/signin/callback`,
    googleConfig()
  )
  if (typeof user === "string") return user
  await saveUser(user)
  return { uid: user.uid, token: await signSession(user, secret) }
}

function page(view: SignInView): Response {
  return new Response(signInPage(view), {
    status: view.kind === "failed" ? 400 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // Google's code is in this page's URL.
      "referrer-policy": "no-referrer",
    },
  })
}
