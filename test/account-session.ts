import { accountOfSession } from "../src/renderer/lib/session"
import { check, finish, section } from "./harness"

/**
 * Who the studio's stored session names, read off its claims.
 *
 * Worth a test because a wrong answer here is the account menu claiming
 * somebody is signed in on a session the server has stopped taking, or
 * drawing nobody on one it still would.
 */

const NOW = Date.UTC(2026, 9, 20)

function session(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${part({ alg: "HS256" })}.${part(claims)}.signature`
}

section("a live session")

check(
  "names who signed in",
  JSON.stringify(
    accountOfSession(
      session({
        sub: "google:1",
        email: "a@example.com",
        name: "Nguyễn Văn A",
        picture: "https://example.com/a.png",
        exp: NOW / 1000 + 60,
      }),
      NOW
    )
  ) ===
    JSON.stringify({
      email: "a@example.com",
      name: "Nguyễn Văn A",
      photo: "https://example.com/a.png",
    })
)
check(
  "with what Google did not say left empty",
  JSON.stringify(
    accountOfSession(session({ sub: "google:1", exp: NOW / 1000 + 60 }), NOW)
  ) === JSON.stringify({ email: null, name: null, photo: null })
)

section("not a session")

check(
  "a lapsed one is nobody",
  accountOfSession(session({ sub: "google:1", exp: NOW / 1000 - 1 }), NOW) ===
    null
)
check(
  "one with no expiry is nobody",
  accountOfSession(session({ sub: "google:1" }), NOW) === null
)
check("not a JWT is nobody", accountOfSession("sk-ant-x", NOW) === null)
check("garbled claims are nobody", accountOfSession("a.!!!.b", NOW) === null)

finish()
