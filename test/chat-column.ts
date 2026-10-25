import type { Chat } from "../src/shared/api"
import {
  avatarHue,
  avatarLetter,
  AVATAR_HUES,
  chatStateOf,
  columnSections,
  limitWayOut,
  railBadgeOf,
  type AccountChoice,
} from "../src/renderer/lib/chat/column"
import { check, finish, section } from "./harness"

/**
 * The projects column: one state per chat row, the three sections a project's
 * chats split into, the badge on a project's icon, and where `Continue with …`
 * moves a chat stopped on a plan limit.
 */

const limit = {
  profileId: null,
  window: "five_hour",
  resetsAt: null,
  text: "",
}

const chat = (id: string, createdAt: string, limited = false): Chat =>
  ({ id, createdAt, ...(limited ? { limit } : {}) }) as Chat

const ids = (chats: Chat[]) => chats.map((entry) => entry.id).join(" ")

section("one state per row")
{
  const a = chat("a", "1")
  const stopped = chat("s", "1", true)
  check("idle is nothing", chatStateOf(a, [], {}, {}) === null)
  check("busy is working", chatStateOf(a, ["a"], {}, {}) === "working")
  check(
    "a question up outranks busy",
    chatStateOf(a, ["a"], { a: {} }, {}) === "waiting"
  )
  check(
    "a limit mark is limited",
    chatStateOf(stopped, [], {}, {}) === "limited"
  )
  check(
    "a turn started past the limit outranks the stale mark",
    chatStateOf(stopped, ["s"], {}, {}) === "working"
  )
  check(
    "the limit outranks the unread it arrived as",
    chatStateOf(stopped, [], {}, { s: true }) === "limited"
  )
  check("unread on its own", chatStateOf(a, [], {}, { a: true }) === "unread")
}

section("sections")
{
  const chats = [
    chat("old", "2026-10-01"),
    chat("asks", "2026-10-02"),
    chat("stuck", "2026-10-03", true),
    chat("busy", "2026-10-04"),
    chat("new", "2026-10-05"),
  ]
  const { needsYou, running, recent } = columnSections(
    chats,
    ["busy", "asks"],
    { asks: {} },
    { new: true }
  )
  check(
    "questions and limits need somebody, newest first",
    ids(needsYou) === "stuck asks",
    ids(needsYou)
  )
  check("a working chat is running", ids(running) === "busy")
  check(
    "the rest is recent, unread included, newest first",
    ids(recent) === "new old",
    ids(recent)
  )
}

section("the rail's badge")
{
  const chats = [chat("a", "1"), chat("b", "1"), chat("c", "1", true)]
  const needs = railBadgeOf(chats, ["a"], { b: {} }, {})
  check(
    "needs counts questions and limits, and wins",
    needs?.kind === "needs" && needs.count === 2
  )
  const working = railBadgeOf(chats.slice(0, 2), ["a", "b"], {}, {})
  check(
    "working when nothing needs anybody",
    working?.kind === "working" && working.count === 2
  )
  const news = railBadgeOf(chats.slice(0, 2), [], {}, { a: true })
  check("unread last", news?.kind === "unread" && news.count === 1)
  check(
    "nothing to say is null",
    railBadgeOf(chats.slice(0, 2), [], {}, {}) === null
  )
}

section("the way on from a limit")
{
  /** The answer as one comparable word: `continue:work`, `buy`, `signIn`. */
  const wayOut = (
    current: string | null,
    accounts: AccountChoice[],
    {
      over = false,
      credits = "ready",
    }: { over?: boolean; credits?: "ready" | "signedOut" | "none" } = {}
  ) => {
    const way = limitWayOut(current, accounts, { over, credits })
    if (!way) return "nothing"
    return way.kind === "continue"
      ? `continue:${way.profileId ?? "login"}`
      : way.kind
  }
  const accounts = [
    { profileId: null, utilization: 100, usable: true },
    { profileId: "work", utilization: 40, usable: true },
    { profileId: "credits", utilization: null, usable: true },
  ]
  check(
    "skips the account it stopped on",
    wayOut(null, accounts) === "continue:work"
  )
  check("skips a full one", wayOut("work", accounts) === "continue:credits")
  check(
    "skips one that cannot run a turn",
    wayOut(null, [
      { profileId: null, utilization: 100, usable: true },
      { profileId: "signed-out", utilization: null, usable: false },
      { profileId: "credits", utilization: null, usable: true },
    ]) === "continue:credits"
  )
  check(
    "an account nobody has measured is offered",
    wayOut("x", [{ profileId: "y", utilization: null, usable: true }]) ===
      "continue:y"
  )
  check(
    "the user's own login is offered back",
    wayOut("work", [
      { profileId: null, utilization: 20, usable: true },
      { profileId: "work", utilization: 100, usable: true },
    ]) === "continue:login"
  )
  check(
    "a reset passed continues where it stopped",
    wayOut("work", accounts, { over: true }) === "continue:work"
  )

  const alone = [{ profileId: null, utilization: 100, usable: true }]
  check(
    "one plan and nowhere to go buys credits",
    wayOut(null, alone) === "buy"
  )
  check(
    "credits at nothing are bought, not continued on",
    wayOut(null, [
      ...alone,
      { profileId: "credits", utilization: null, usable: false },
    ]) === "buy"
  )
  check(
    "signed out of Vey Studio signs in first",
    wayOut(null, alone, { credits: "signedOut" }) === "signIn"
  )
  check(
    "a build with no credits offers only the wait",
    wayOut(null, alone, { credits: "none" }) === "nothing"
  )
}

section("avatars")
check("first letter, upper-cased", avatarLetter("work") === "W")
check("skips leading punctuation", avatarLetter("  (hùng)") === "H")
check("a name with no letter", avatarLetter("—") === "?")
check(
  "a hue is one of the palette's, the same every time",
  AVATAR_HUES.includes(avatarHue("abc")) &&
    avatarHue("abc") === avatarHue("abc")
)

finish()
