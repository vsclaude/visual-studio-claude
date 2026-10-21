/**
 * The studio's half of Google sign-in, run against a real socket.
 *
 * The server is stood in for by the test, with the routes `vsclaude-cloud`
 * answers (`server/api/signin/`): `204` until the page has answered, then the
 * answer once. The browser is stood in for too: it takes the URL the flow
 * would open and leaves an answer under its nonce. What matters is what the
 * attempt does with each — and that it stops asking once it has one.
 */
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import {
  cancelSignInWithGoogle,
  parseAnswer,
  signInWithGoogle,
} from "../src/main/google-sign-in"
import { SIGN_IN_CANCELLED } from "../src/shared/sign-in"
import { check, finish, section } from "./harness"

/** What the page left, by nonce, and how often each nonce was asked about. */
const answers = new Map<string, string>()
const asked = new Map<string, number>()

const server = createServer((request, response) => {
  const match = /^\/api\/signin\/([^/]+)$/.exec(request.url ?? "")
  if (request.method !== "GET" || !match) {
    response.writeHead(404).end()
    return
  }
  const nonce = match[1]!
  asked.set(nonce, (asked.get(nonce) ?? 0) + 1)
  const answer = answers.get(nonce)
  if (answer === undefined) {
    response.writeHead(204).end()
    return
  }
  answers.delete(nonce)
  response.writeHead(200, { "content-type": "application/json" }).end(answer)
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

const POLL_MS = 10

/** Starts an attempt and hands back the page URL the browser would be sent
 * to, and its nonce. */
function attempt(): Promise<{
  url: string
  nonce: string
  outcome: Promise<string>
}> {
  // `openUrl` runs synchronously inside `signInWithGoogle`, before its return
  // value exists, so the page is handed out through a promise and the outcome
  // is attached after the call. Closing over `outcome` in the callback would
  // read a `const` still in its temporal dead zone, and the attempt would
  // never be handed back.
  let opened!: (url: string) => void
  const page = new Promise<string>((resolve) => (opened = resolve))
  const outcome = signInWithGoogle(base, opened, { pollMs: POLL_MS })
  // Swallowed here and read through `settled`; an unhandled rejection
  // would end the run.
  outcome.catch(() => {})
  return page.then((url) => ({ url, nonce: url.split("/").pop()!, outcome }))
}

/** The attempt's answer as a plain value, whichever way it went. */
function settled(outcome: Promise<string>): Promise<string> {
  return outcome.then(
    (token) => `resolved:${token}`,
    (error: Error) => `rejected:${error.message}`
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

section("the page")

const first = await attempt()
check(
  "opens the server's sign-in page",
  first.url.startsWith(`${base}/signin/`),
  first.url
)
check(
  "under a nonce of 24 random bytes",
  /^[A-Za-z0-9_-]{32}$/.test(first.nonce),
  first.nonce
)

section("the token")

await wait(POLL_MS * 5)
check(
  "asks while there is no answer yet",
  (asked.get(first.nonce) ?? 0) >= 2,
  asked.get(first.nonce)
)
answers.set(first.nonce, JSON.stringify({ token: "abc.def" }))
check(
  "resolves with the token the page left",
  (await settled(first.outcome)) === "resolved:abc.def"
)
const askedAtAnswer = asked.get(first.nonce)
await wait(POLL_MS * 5)
check(
  "stops asking once it has the answer",
  asked.get(first.nonce) === askedAtAnswer,
  `${askedAtAnswer} → ${asked.get(first.nonce)}`
)

section("a failed answer")

const failing = await attempt()
answers.set(failing.nonce, JSON.stringify({ error: "The popup was closed." }))
check(
  "rejects with the page's reason",
  (await settled(failing.outcome)) === "rejected:The popup was closed."
)

section("an answer that is not one")

const garbled = await attempt()
answers.set(garbled.nonce, "not json")
await wait(POLL_MS * 5)
answers.set(garbled.nonce, JSON.stringify({ token: "after" }))
check(
  "is passed over, and the next ask still finds the real one",
  (await settled(garbled.outcome)) === "resolved:after"
)

section("a second press of the button")

const older = await attempt()
const newer = await attempt()
check("each attempt draws its own nonce", older.nonce !== newer.nonce)
check(
  "the older attempt is ended with a reason",
  (await settled(older.outcome)).startsWith(
    "rejected:Sign-in was started again"
  )
)
answers.set(newer.nonce, JSON.stringify({ token: "newer" }))
check(
  "the newer attempt still takes its token",
  (await settled(newer.outcome)) === "resolved:newer"
)

section("a cancelled sign-in")

// The tab was closed, so nothing will ever answer: cancelling is the only way
// the attempt ends before its timeout.
const abandoned = await attempt()
cancelSignInWithGoogle()
check(
  "the attempt ends at once with the shared cancel reason",
  (await settled(abandoned.outcome)) === `rejected:${SIGN_IN_CANCELLED}`
)
const askedAtCancel = asked.get(abandoned.nonce) ?? 0
await wait(POLL_MS * 5)
check("and stops asking", (asked.get(abandoned.nonce) ?? 0) === askedAtCancel)

section("what counts as an answer")

check(
  "a token is an answer",
  JSON.stringify(parseAnswer('{"token":"x"}')) === '{"token":"x"}'
)
check(
  "an error is an answer",
  JSON.stringify(parseAnswer('{"error":"no"}')) === '{"error":"no"}'
)
check(
  "an empty object is an answer with neither",
  JSON.stringify(parseAnswer("{}")) === "{}"
)
check(
  "a non-object is refused",
  parseAnswer("[]") === null && parseAnswer("42") === null
)
check(
  "a token that is not a string is refused",
  parseAnswer('{"token":42}') === null
)
check("an empty token is refused", parseAnswer('{"token":""}') === null)

server.close()
finish()
