import { create } from "zustand"

import type {
  Months,
  PaymentMethod,
  PlanId,
  PurchaseItem,
  PurchaseResult,
  StudioAccount,
} from "@shared/plans"
import { useFreeAi } from "./free-ai"

/**
 * Whether the Upgrade dialog is open, so the account menu and the composer's
 * Hobby row can both open the one dialog the window mounts
 * (`plans-dialog.tsx`).
 */
type PlansDialogState = {
  open: boolean
  tab: "plans" | "credits"
  method: PaymentMethod
  /** How many months a bank transfer buys — cards renew monthly. */
  months: Months
  show: (tab?: "plans" | "credits") => void
  close: () => void
  setMethod: (method: PaymentMethod) => void
  setMonths: (months: Months) => void
}

export const usePlansDialog = create<PlansDialogState>()((set) => ({
  open: false,
  tab: "plans",
  // Bank transfer for somebody whose system is in Vietnamese — it is cheaper
  // for them and needs no card. Anybody else is most likely outside Vietnam,
  // where only a card works.
  method: navigator.language.toLowerCase().startsWith("vi") ? "bank" : "card",
  months: 1,
  show: (tab = "plans") => {
    set({ open: true, tab })
    void useStudioAccount.getState().refresh()
  },
  close: () => set({ open: false }),
  setMethod: (method) => set({ method }),
  setMonths: (months) => set({ months }),
}))

/**
 * The signed-in user's plan as the server has it (`StudioAccount`).
 *
 * A purchase happens in the browser and reaches the server as SePay's or
 * Paddle's webhook, so nothing here learns of it directly: the account is re-asked when
 * the dialog opens and whenever the window takes focus back — which is what
 * coming back from a checkout tab is.
 */
type StudioAccountState = {
  account: StudioAccount | null
  /** The item a checkout is being opened for, or `manage`. */
  pending: PurchaseItem | "manage" | null
  error: string | null
  refresh: () => Promise<void>
  buy: (item: PurchaseItem, method: PaymentMethod) => Promise<void>
  manage: () => Promise<void>
}

export const useStudioAccount = create<StudioAccountState>()((set, get) => {
  const open = async (
    pending: PurchaseItem | "manage",
    call: () => Promise<PurchaseResult>
  ) => {
    if (get().pending) return
    set({ pending, error: null })
    try {
      const result = await call()
      set({ error: result.ok ? null : result.error })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      set({ pending: null })
    }
  }

  return {
    account: null,
    pending: null,
    error: null,
    async refresh() {
      if (!useFreeAi.getState().ready) {
        set({ account: null })
        return
      }
      try {
        set({ account: await window.desktop.studioAccount() })
      } catch (error) {
        console.error("Could not ask the server for the plan", error)
      }
    },
    buy: (item, method) =>
      open(item, () => window.desktop.buyPlanItem(item, method)),
    manage: () => open("manage", () => window.desktop.managePlan()),
  }
})

/** The plan to draw: the server's, or Hobby while it has not said. */
export function useCurrentPlan(): PlanId {
  return useStudioAccount((state) => state.account?.plan ?? "hobby")
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
