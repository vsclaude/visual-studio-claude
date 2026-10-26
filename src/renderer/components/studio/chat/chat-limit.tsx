import { useState } from "react"
import { Coins } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Google } from "@/components/ui/svgs/google"
import { useAccount } from "@/lib/account"
import { limitWayOut, type LimitWayOut } from "@/lib/chat/column"
import { isResetDue } from "@/lib/chat/plan-usage"
import { useChats } from "@/lib/chat/store"
import { useCreditsDialog } from "@/lib/credits"
import { useFreeAi } from "@/lib/free-ai"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { chatOptions, type Chat } from "@shared/api"
import {
  CREDITS_GRADIENT,
  CREDITS_SURFACE,
  CreditsBadge,
} from "../credits-badge"
import { useAccountName, useColumnAccounts } from "../project/accounts"

/**
 * The way on from a chat its plan limit stopped, as one action — what the
 * column's card and the transcript's limit line both draw, so the two never
 * offer different things (`limitWayOut` decides which).
 *
 * `continue` moves the chat and sends `Continue.`: the transcript goes with
 * it (`carryTranscript` in `main/chat.ts`). `buy` opens the credits dialog;
 * once a purchase lands credits are `usable` and the same action becomes
 * `Continue with Credits`. `onContinue` is the column's, which opens the chat
 * it was clicked from before the turn starts.
 */
export function useLimitWayOut(
  chat: Chat,
  now: Date,
  onContinue?: () => void
): {
  way: LimitWayOut
  label: string
  busy: boolean
  run: () => void
} | null {
  const t = useT()
  const accounts = useColumnAccounts()
  const available = useFreeAi((state) => state.available)
  const ready = useFreeAi((state) => state.ready)
  const signingIn = useAccount((state) => state.busy)
  const signIn = useAccount((state) => state.signIn)
  const [moving, setMoving] = useState(false)

  const current = chatOptions(chat.options).profileId ?? null
  const over = isResetDue(chat.limit?.resetsAt ?? null, now)
  const way = limitWayOut(current, accounts, {
    over,
    credits: ready ? "ready" : available ? "signedOut" : "none",
  })
  const name = useAccountName(way?.kind === "continue" ? way.profileId : null)

  if (!way) return null
  if (way.kind === "buy") {
    return {
      way,
      label: t("chat.limit.buyToKeepGoing"),
      busy: false,
      run: () => useCreditsDialog.getState().show(),
    }
  }
  if (way.kind === "signIn") {
    return {
      way,
      label: signingIn
        ? t("chat.credits.signingIn")
        : t("chat.limit.signInToUse"),
      busy: signingIn,
      run: () => void signIn(),
    }
  }
  return {
    way,
    label: over
      ? t("chat.limit.continue")
      : t("chat.limit.continueWith", { name }),
    busy: moving,
    run: () => {
      setMoving(true)
      const chats = useChats.getState()
      void chats
        .setOptions(chat.id, {
          ...chatOptions(chat.options),
          profileId: way.profileId,
        })
        .then(() => {
          onContinue?.()
          return chats.send(chat.id, "Continue.")
        })
        .finally(() => setMoving(false))
    },
  }
}

/**
 * Under the transcript's limit line, the way on — only on the line that
 * stopped the chat as it stands, since an older one is about a limit a later
 * message already got past.
 *
 * Moving to another account is a button and no more: the line above already
 * says what happened. Credits get a card, because for somebody on one plan
 * they are news — the line says to wait hours, and this is the one place that
 * says they do not have to.
 */
export function LimitWayOutCard({ chat, now }: { chat: Chat; now: Date }) {
  const t = useT()
  const action = useLimitWayOut(chat, now)
  if (!action) return null

  if (action.way.kind === "continue") {
    return (
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={action.busy}
          onClick={action.run}
        >
          {action.label}
        </Button>
      </div>
    )
  }

  const buying = action.way.kind === "buy"
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        CREDITS_SURFACE
      )}
    >
      <CreditsBadge size="sm" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{t("chat.limit.noWait")}</p>
        <p className="text-xs text-muted-foreground">
          {buying ? t("chat.limit.buyBody") : t("chat.limit.signInBody")}
        </p>
      </div>
      {buying ? (
        <Button
          size="sm"
          onClick={action.run}
          className={cn(
            "border-0 text-white shadow-sm shadow-violet-500/25 hover:opacity-90",
            CREDITS_GRADIENT
          )}
        >
          <Coins data-icon="inline-start" />
          {t("chat.credits.buy")}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={action.busy}
          onClick={action.run}
        >
          {!action.busy && <Google data-icon="inline-start" />}
          {action.busy
            ? t("chat.credits.signingIn")
            : t("chat.credits.signInWithGoogle")}
        </Button>
      )}
    </div>
  )
}
