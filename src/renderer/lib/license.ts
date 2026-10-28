import { useMemo } from "react"
import { create } from "zustand"

import {
  isPro,
  lockedFolderIds,
  type LicenseResult,
  type ProStatus,
  type PurchaseResult,
} from "@shared/license"
import { useStudio } from "./store"
import { watchStudioServer } from "./studio-server"

/**
 * Vey Pro as the window knows it — `shared/license.ts` has what it is.
 *
 * `status` is main's answer for this device, asked at launch — which also
 * checks in with the server, the one way a refunded key ends — and again
 * whenever the window takes focus back, since a purchase is paid in a banking
 * app and coming back is the moment to ask whether it landed. There is no
 * sign-in: another device is a key pasted into the dialog (`activate`). The
 * dialog is one per window, opened from the title bar's `PlanBadge` and a
 * second `Add project` on Free (`pro-dialog.tsx`).
 */
type ProState = {
  /** Null until main has answered once — the gate opens nothing on null,
   * rather than refusing a project for a frame. */
  status: ProStatus | null
  open: boolean
  /** A checkout this window opened is still waiting on its money. */
  awaiting: boolean
  /** The browser is being asked for the page, or a key is being put on or
   * taken off this device. */
  busy: boolean
  error: string | null
  show: () => void
  close: () => void
  refresh: () => Promise<void>
  /** Asks the server where this device stands (`claimLicense`). */
  claim: () => Promise<void>
  buy: (seats: number, email: string) => Promise<void>
  /** A pasted key, put on this device. True when it took. */
  activate: (key: string) => Promise<boolean>
  /** This device taken off its key. */
  deactivate: () => Promise<void>
}

/** How often, and for how long, the server is re-asked after a checkout
 * opens. Long enough for somebody to find their phone and open a banking
 * app; a transfer that lands later is still claimed on the next focus. */
const POLL_MS = 5_000
const AWAIT_MS = 30 * 60_000

let poll: ReturnType<typeof setInterval> | null = null
let pollUntil = 0

function stopAwaiting() {
  if (poll) clearInterval(poll)
  poll = null
  usePro.setState({ awaiting: false })
}

/** Main's own sentence, past Electron's "Error invoking remote method …:"
 * wrapper. */
function sentenceOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ""
  )
}

export const usePro = create<ProState>()((set, get) => ({
  status: null,
  open: false,
  awaiting: false,
  busy: false,
  error: null,
  show: () => set({ open: true, error: null }),
  close: () => set({ open: false }),
  async refresh() {
    try {
      set({ status: await window.desktop.proStatus() })
    } catch (error) {
      console.error("Could not ask where Pro stands", error)
    }
  },
  async claim() {
    try {
      const status = await window.desktop.claimLicense()
      set({ status })
      if (isPro(status)) stopAwaiting()
    } catch (error) {
      // A licence that came back and did not verify — the one thing here
      // the dialog has to say out loud, since it is somebody who has paid.
      console.error("Could not ask the server for a licence", error)
      stopAwaiting()
      set({ error: sentenceOf(error), open: true })
    }
  },
  async buy(seats, email) {
    if (get().busy) return
    set({ busy: true, error: null })
    try {
      const result: PurchaseResult = await window.desktop.buyLicense(
        seats,
        email
      )
      set({ error: result.ok ? null : result.error })
      if (result.ok) {
        set({ awaiting: true })
        pollUntil = Date.now() + AWAIT_MS
        poll ??= setInterval(() => {
          if (Date.now() > pollUntil) stopAwaiting()
          else void get().claim()
        }, POLL_MS)
      }
    } catch (error) {
      set({ error: sentenceOf(error) })
    } finally {
      set({ busy: false })
    }
  },
  async activate(key) {
    if (get().busy) return false
    set({ busy: true, error: null })
    try {
      return settle(set, await window.desktop.activateLicense(key))
    } catch (error) {
      set({ error: sentenceOf(error) })
      return false
    } finally {
      set({ busy: false })
    }
  },
  async deactivate() {
    if (get().busy) return
    set({ busy: true, error: null })
    try {
      settle(set, await window.desktop.deactivateLicense())
    } catch (error) {
      set({ error: sentenceOf(error) })
    } finally {
      set({ busy: false })
    }
  },
}))

function settle(
  set: (partial: Partial<ProState>) => void,
  result: LicenseResult
): boolean {
  if (result.ok) set({ status: result.status, error: null })
  else set({ error: result.error })
  return result.ok
}

/** Whether Pro's features are on, for the gates. Null before the first
 * answer reads as on: see `status`. */
export function useIsPro(): boolean {
  const status = usePro((state) => state.status)
  return status === null || isPro(status)
}

const NONE = new Set<string>()

/** The folders Free has locked (`lockedFolderIds`) — none before main has
 * answered, as `useIsPro` reads it. */
export function useLockedFolders(): Set<string> {
  const status = usePro((state) => state.status)
  const folders = useStudio((state) => state.folders)
  return useMemo(
    () => (status ? lockedFolderIds(status, folders) : NONE),
    [status, folders]
  )
}

let watching = false

/**
 * Reads at launch, then checks in with the server, then claims again on every
 * focus while not Pro — a GET that answers 404 until a purchase on this device
 * lands. Idempotent; called by each window's root.
 */
export function watchPro(): void {
  if (watching) return
  watching = true
  watchStudioServer()
  const { refresh, claim } = usePro.getState()
  void refresh().then(claim)
  window.addEventListener("focus", () => {
    const { status } = usePro.getState()
    if (status?.kind === "licensed") void refresh()
    else void claim()
  })
}
