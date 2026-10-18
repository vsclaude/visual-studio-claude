import { create } from "zustand"

/**
 * Whether the Upgrade dialog is open, so the account menu and the composer's
 * Hobby row can both open the one dialog the window mounts
 * (`plans-dialog.tsx`).
 */
type PlansDialogState = {
  open: boolean
  tab: "plans" | "credits"
  show: (tab?: "plans" | "credits") => void
  close: () => void
}

export const usePlansDialog = create<PlansDialogState>()((set) => ({
  open: false,
  tab: "plans",
  show: (tab = "plans") => set({ open: true, tab }),
  close: () => set({ open: false }),
}))
