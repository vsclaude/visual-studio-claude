import { Coins } from "lucide-react"

import { formatCredits } from "@shared/credits"
import { Button } from "@/components/ui/button"
import { Google } from "@/components/ui/svgs/google"
import { useAccount } from "@/lib/account"
import type { CreditsRefusal } from "@/lib/chat/credits-refusal"
import { useCreditsDialog, useStudioAccount } from "@/lib/credits"
import { useFreeAi } from "@/lib/free-ai"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  CREDITS_GRADIENT,
  CREDITS_SURFACE,
  CreditsBadge,
} from "../credits-badge"

/**
 * A turn refused for want of credits, drawn as the way out of it.
 *
 * It used to be one more red line — `API Error: 400 {…}` with the sentence
 * buried in the JSON, telling somebody to go and find the account menu. That
 * is the moment a person is most ready to buy, sitting in the transcript they
 * were trying to use, so the button is here rather than a menu away. The raw
 * error is not shown: everything in it is said better by the card.
 *
 * The card is a line in the history and outlives the problem, so it reads the
 * balance *now*: once credits have arrived it says so and asks for the message
 * again instead of selling a pack somebody already bought.
 */
export function CreditsRefusalCard({ reason }: { reason: CreditsRefusal }) {
  const t = useT()
  const ready = useFreeAi((state) => state.ready)
  const credits = useStudioAccount((state) => state.account?.credits)
  const show = useCreditsDialog((state) => state.show)
  const busy = useAccount((state) => state.busy)
  const signIn = useAccount((state) => state.signIn)

  const signedOut = reason === "signed-out" && !ready
  const topped = !signedOut && ready && credits !== undefined && credits > 0

  const [title, body] = signedOut
    ? [
        t("chat.creditsRefusal.signInTitle"),
        t("chat.creditsRefusal.signInBody"),
      ]
    : topped
      ? [
          reason === "signed-out"
            ? t("chat.creditsRefusal.signedInTitle")
            : t("chat.creditsRefusal.backTitle"),
          t("chat.creditsRefusal.backBody", {
            credits: formatCredits(credits),
          }),
        ]
      : [t("chat.creditsRefusal.outTitle"), t("chat.creditsRefusal.outBody")]

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        CREDITS_SURFACE
      )}
    >
      <CreditsBadge size="sm" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      {signedOut ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void signIn()}
        >
          {!busy && <Google data-icon="inline-start" />}
          {busy
            ? t("chat.credits.signingIn")
            : t("chat.credits.signInWithGoogle")}
        </Button>
      ) : (
        !topped && (
          <Button
            size="sm"
            onClick={show}
            className={cn(
              "border-0 text-white shadow-sm shadow-violet-500/25 hover:opacity-90",
              CREDITS_GRADIENT
            )}
          >
            <Coins data-icon="inline-start" />
            {t("chat.credits.buy")}
          </Button>
        )
      )}
    </div>
  )
}
