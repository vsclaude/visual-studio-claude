import { useEffect, useRef } from "react"

import { creditsLeft, formatCredits } from "@shared/credits"
import { useCreditsDialog, useStudioAccount } from "@/lib/credits"
import { useFreeAi } from "@/lib/free-ai"
import { cn } from "@/lib/utils"
import { CreditsBar } from "../credits-badge"

/**
 * The balance, where `PlanUsageMeter` sits for a chat on a `claude` login.
 *
 * A chat paying with credits has no plan windows — main answers the plan
 * question with nothing for it — so that slot was empty on exactly the chats
 * where what is left matters most. This is the same idea for the other way of
 * paying: what the next message is spending, in front of the person about to
 * send it. A click is the way to more, rather than a popover of detail: there
 * is one number, and it is already on the button.
 *
 * Re-asked when a turn ends, the moment the number moved. Everything else —
 * sign-in, focus, a checkout landing — `watchStudioAccount` already covers.
 */
export function CreditsMeter({ sending }: { sending: boolean }) {
  const ready = useFreeAi((state) => state.ready)
  const account = useStudioAccount((state) => state.account)
  const refresh = useStudioAccount((state) => state.refresh)
  const show = useCreditsDialog((state) => state.show)

  const wasSending = useRef(sending)
  useEffect(() => {
    if (wasSending.current && !sending) void refresh()
    wasSending.current = sending
  }, [sending, refresh])

  if (!ready || !account) return null

  const { low } = creditsLeft(account)
  const broke = account.credits <= 0

  return (
    <button
      type="button"
      onClick={show}
      title={
        broke
          ? "No credits left — buy more to keep going"
          : `${formatCredits(account.credits)} credits left — buy more`
      }
      aria-label="Credits"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[0.7rem] tabular-nums",
        "transition-colors hover:bg-accent",
        broke
          ? "text-destructive"
          : low
            ? "text-amber-600 dark:text-amber-500"
            : "text-muted-foreground"
      )}
    >
      <CreditsBar account={account} className="h-1 w-6" />
      {broke ? "No credits" : `${formatCredits(account.credits)} left`}
    </button>
  )
}
