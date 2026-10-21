import { create } from "zustand"

import { SIGN_IN_CANCELLED } from "@shared/sign-in"

import { handFreeAiToken, watchFreeAi } from "./free-ai"
import { watchStudioAccount } from "./credits"
import { accountOfSession, type Account } from "./session"

/**
 * Who is signed in to the studio, through the free AI's server.
 *
 * Signing in is the one thing that needs the main process: the Google page has
 * to open in the user's browser (`main/google-sign-in.ts`), and what comes
 * back is the server's **session token** — ninety days, signed by the server,
 * naming who signed in. It is kept in this window's own storage, the way
 * Firebase kept its session, so it survives a relaunch; main is handed it and
 * turns it into the hour-long tokens the free AI's requests carry
 * (`main/free-ai.ts`).
 */

export type { Account }

type AccountState = {
  /** False until the stored session has been read — before that, neither
   * "signed in" nor "signed out" is true. */
  ready: boolean
  account: Account | null
  /** A sign-in is waiting on the browser, or a sign-out is running. */
  busy: boolean
  error: string | null
  signIn: () => Promise<void>
  /** Ends a sign-in waiting on the browser. The waiting `signIn` then returns
   * quietly, since a cancel is what the user asked for. */
  cancelSignIn: () => Promise<void>
  signOut: () => Promise<void>
}

const SESSION_KEY = "vsclaude.session"

/** The stored session and who it names, or nulls for none or a lapsed one. */
function storedSession(): { session: string; account: Account } | null {
  const session = localStorage.getItem(SESSION_KEY)
  const account = session ? accountOfSession(session) : null
  if (!session || !account) {
    if (session) localStorage.removeItem(SESSION_KEY)
    return null
  }
  return { session, account }
}

/** Draws whoever the stored session names and hands main the session. */
function adoptStored(): void {
  const stored = storedSession()
  useAccount.setState({ ready: true, account: stored?.account ?? null })
  void handFreeAiToken(stored?.session ?? null)
}

let watching = false

/** Reads the stored session, and follows it. Idempotent: every caller asks
 * for it, and only the first one listens. */
export function watchAccount(): void {
  if (watching) return
  watching = true

  watchFreeAi()
  // The credits are asked of the same server as the same user, so it follows
  // the session in.
  watchStudioAccount()
  adoptStored()

  // A popped-out chat window shares this storage: signing in or out in one
  // window is signing in or out in all of them.
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY || event.key === null) adoptStored()
  })
}

export const useAccount = create<AccountState>()((set) => ({
  ready: false,
  account: null,
  busy: false,
  error: null,

  signIn: async () => {
    set({ busy: true, error: null })
    try {
      const session = await window.desktop.signInWithGoogle()
      const account = accountOfSession(session)
      if (!account) throw new Error("The server answered with no sign-in.")
      localStorage.setItem(SESSION_KEY, session)
      set({ busy: false, account })
      await handFreeAiToken(session)
    } catch (error) {
      const message = messageOf(error)
      set({
        busy: false,
        error: message === SIGN_IN_CANCELLED ? null : message,
      })
    }
  },

  cancelSignIn: async () => {
    await window.desktop.cancelSignInWithGoogle()
  },

  signOut: async () => {
    set({ busy: true, error: null })
    localStorage.removeItem(SESSION_KEY)
    set({ busy: false, account: null })
    await handFreeAiToken(null)
  },
}))

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
