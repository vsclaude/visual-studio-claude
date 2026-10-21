import { create } from "zustand"

import {
  creditsArrived,
  formatCredits,
  type CreditPack,
  type PaymentMethod,
  type PurchaseResult,
  type StudioAccount,
} from "@shared/credits"
import { useFreeAi } from "./free-ai"

/**
 * Whether the credits dialog is open, so the account menu and the composer's
 * Studio AI row can both open the one dialog the window mounts
 * (`credits-dialog.tsx`).
 */
type CreditsDialogState = {
  open: boolean
  method: PaymentMethod
  show: () => void
  close: () => void
  setMethod: (method: PaymentMethod) => void
}

export const useCreditsDialog = create<CreditsDialogState>()((set) => ({
  open: false,
  // Bank transfer for somebody whose system is in Vietnamese — it is cheaper
  // for them and needs no card. Anybody else is most likely outside Vietnam,
  // where only a card works.
  method: navigator.language.toLowerCase().startsWith("vi") ? "bank" : "card",
  show: () => {
    set({ open: true })
    void useStudioAccount.getState().refresh()
  },
  close: () => set({ open: false }),
  setMethod: (method) => set({ method }),
}))

/**
 * The signed-in user's day and credits as the server has them
 * (`StudioAccount`).
 *
 * A purchase happens in the browser and reaches the server as SePay's or
 * Paddle's webhook, so nothing here learns of it directly: the account is
 * re-asked when the dialog opens, whenever the window takes focus back —
 * which is what coming back from a checkout tab is — and every few seconds
 * while a purchase this window opened is `awaiting` its payment.
 *
 * A balance going up while one is awaited is an **arrival**, and the window
 * says so (`CreditsArrived`). Only the window that opened the checkout: every
 * window has this store and re-reads on focus, and one purchase celebrated in
 * the studio and again in a popped-out chat is one too many.
 */
type StudioAccountState = {
  account: StudioAccount | null
  /** The pack a checkout is being opened for. */
  pending: CreditPack["id"] | null
  /** Whether a checkout this window opened is still waiting on its money. */
  awaiting: boolean
  /** What the last purchase added and the balance it left, until dismissed. */
  arrived: { added: number; balance: number } | null
  error: string | null
  refresh: () => Promise<void>
  buy: (item: CreditPack["id"], method: PaymentMethod) => Promise<void>
  dismissArrival: () => void
}

/**
 * How often, and for how long, the server is re-asked after a checkout opens.
 * Long enough for somebody to find their phone and open a banking app; a
 * transfer that lands later is still credited, and seen on the next focus.
 */
const POLL_MS = 5_000
const AWAIT_MS = 30 * 60_000

let poll: ReturnType<typeof setInterval> | null = null
let pollUntil = 0

function stopAwaiting() {
  if (poll) clearInterval(poll)
  poll = null
  useStudioAccount.setState({ awaiting: false })
}

export const useStudioAccount = create<StudioAccountState>()((set, get) => ({
  account: null,
  pending: null,
  awaiting: false,
  arrived: null,
  error: null,
  async refresh() {
    if (!useFreeAi.getState().ready) {
      stopAwaiting()
      set({ account: null })
      return
    }
    let next: StudioAccount | null
    try {
      next = await window.desktop.studioAccount()
    } catch (error) {
      console.error("Could not ask the server for the account", error)
      return
    }
    const added = creditsArrived(get().account, next)
    set({ account: next })
    if (added > 0 && next && get().awaiting) {
      stopAwaiting()
      set({ arrived: { added, balance: next.credits } })
      announce(added)
    }
  },
  async buy(item, method) {
    if (get().pending) return
    set({ pending: item, error: null })
    try {
      const result: PurchaseResult = await window.desktop.buyCredits(
        item,
        method
      )
      set({ error: result.ok ? null : result.error })
      if (result.ok) {
        set({ awaiting: true })
        pollUntil = Date.now() + AWAIT_MS
        poll ??= setInterval(() => {
          if (Date.now() > pollUntil) stopAwaiting()
          else void get().refresh()
        }, POLL_MS)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      set({ pending: null })
    }
  },
  dismissArrival: () => set({ arrived: null }),
}))

/**
 * A system notification for an arrival nobody is looking at — the payment is
 * usually made from the browser or a phone, so the window is rarely focused
 * when it lands. Clicking it brings the window back, where the dialog waits.
 */
function announce(added: number) {
  if (document.hasFocus() || typeof Notification === "undefined") return
  const notice = new Notification("Credits added", {
    body: `+${formatCredits(added)} in credits is on your account. It never expires.`,
    silent: false,
  })
  notice.onclick = () => window.focus()
}

let watching = false

/**
 * Re-asks on sign-in, sign-out and focus. Idempotent; called by each window's
 * root, like `watchAccount`.
 */
export function watchStudioAccount(): void {
  if (watching) return
  watching = true
  const refresh = () => void useStudioAccount.getState().refresh()
  useFreeAi.subscribe((state, before) => {
    if (state.ready !== before.ready) refresh()
  })
  window.addEventListener("focus", refresh)
  refresh()
}
