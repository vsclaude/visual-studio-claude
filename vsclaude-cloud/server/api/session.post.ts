import { defineHandler } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import { getUser } from "../utils/accounts.ts"
import { noteRequest } from "../utils/log.ts"
import {
  ACCESS_TTL_S,
  signAccess,
  tokenOf,
  verifySession,
} from "../utils/session.ts"

/**
 * `POST /api/session` with the studio's session token as the bearer —
 * answered as `{ token, expiresAt }`, an hour's access token for every other
 * request (`session.ts`). The studio's main process asks again before the
 * hour is up.
 *
 * The user has to still be in `users`: deleting the row is how somebody's
 * sessions are ended, since a signed token cannot be taken back.
 */
export default defineHandler(async (event) => {
  const secret = String(useRuntimeConfig().sessionSecret)
  const token = tokenOf(event.req.headers)
  if (!token) {
    noteRequest(event, { refused: "no session" })
    return Response.json({ error: "Sign in again." }, { status: 401 })
  }
  const verified = await verifySession(token, secret)
  if (!verified.ok) {
    noteRequest(event, { refused: verified.reason })
    return Response.json(
      { error: `Sign in again: ${verified.reason}.` },
      { status: 401 }
    )
  }
  const user = await getUser(verified.user.uid)
  if (!user) {
    noteRequest(event, { refused: "no such user" })
    return Response.json({ error: "Sign in again." }, { status: 401 })
  }
  noteRequest(event, { uid: user.uid })
  const now = Math.floor(Date.now() / 1000)
  return {
    token: await signAccess(user, secret, now),
    expiresAt: (now + ACCESS_TTL_S) * 1000,
  }
})
