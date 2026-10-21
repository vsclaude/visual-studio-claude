import { useEffect } from "react"
import { ChevronRight, UserRound } from "lucide-react"

import { creditsLeft, formatCredits } from "@shared/credits"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useAccount, watchAccount } from "@/lib/account"
import { useCreditsDialog, useStudioAccount } from "@/lib/credits"
import { cn } from "@/lib/utils"
import { CreditsBadge, CreditsBar } from "./credits-badge"
import { IconButton } from "./icon-button"

/**
 * Who is signed in, at the foot of the window's rail under Settings.
 *
 * An avatar rather than a row of text: the rail is 48px wide, and the thing to
 * know at a glance is only whether somebody is signed in. The name and the
 * actions are one click away in the menu it opens.
 */
export function AccountMenu() {
  const ready = useAccount((state) => state.ready)
  const account = useAccount((state) => state.account)
  const busy = useAccount((state) => state.busy)
  const error = useAccount((state) => state.error)
  const signIn = useAccount((state) => state.signIn)
  const cancelSignIn = useAccount((state) => state.cancelSignIn)
  const signOut = useAccount((state) => state.signOut)
  const showCredits = useCreditsDialog((state) => state.show)
  const studio = useStudioAccount((state) => state.account)

  useEffect(watchAccount, [])

  const name = account ? (account.name ?? account.email ?? "Signed in") : null
  // Until the stored session has been read, the empty silhouette would say "signed out"
  // about somebody who is about to be signed in. A sign-in waiting on the
  // browser spins too, since the avatar is all there is to look at meanwhile.
  const loading = !ready || (busy && !account)
  // The one thing on the rail that says a balance is running out, for somebody
  // whose chats are on a login and never see the composer's meter go amber.
  const low = account && studio ? creditsLeft(studio).low : false

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            label={
              !ready
                ? "Checking your sign-in…"
                : (name ?? (busy ? "Signing in…" : "Sign in with Google"))
            }
            side="right"
            className="relative size-8"
          >
            {low && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 right-0.5 size-2 rounded-full ring-2 ring-background",
                  studio && studio.credits <= 0 ? "bg-red-500" : "bg-amber-500"
                )}
              />
            )}
            {loading ? (
              <Spinner className="size-4 text-muted-foreground" />
            ) : account?.photo ? (
              <img
                src={account.photo}
                alt=""
                referrerPolicy="no-referrer"
                className="size-6 rounded-full"
              />
            ) : account ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[0.65rem] font-medium text-primary-foreground">
                {initialOf(name ?? "")}
              </span>
            ) : (
              <UserRound />
            )}
          </IconButton>
        }
      />
      <DropdownMenuContent side="right" align="end" className="w-64">
        {/* A label is only valid inside a group — the menu throws without one. */}
        <DropdownMenuGroup>
          {account ? (
            <>
              <DropdownMenuLabel className="space-y-0.5">
                <span className="block text-sm font-medium">{name}</span>
                {account.email && account.email !== name && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {account.email}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* The balance and the way to more as one row: the badge and
                  the bar are the composer's and Settings', so credits look
                  like credits wherever they are met. */}
              <DropdownMenuItem
                onClick={showCredits}
                className="cursor-pointer items-center gap-3 px-2 py-2"
              >
                <CreditsBadge size="sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">Buy credits</span>
                    {studio && (
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          studio.credits <= 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatCredits(studio.credits)} left
                      </span>
                    )}
                  </span>
                  {studio ? (
                    <CreditsBar account={studio} className="h-1" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Every model, never a monthly fee
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={busy} onClick={() => void signOut()}>
                Sign out
              </DropdownMenuItem>
            </>
          ) : busy ? (
            <>
              <DropdownMenuLabel>
                Finish signing in in your browser…
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void cancelSignIn()}>
                Cancel
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem disabled={!ready} onClick={() => void signIn()}>
              Sign in with Google
            </DropdownMenuItem>
          )}

          {error && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal whitespace-normal text-destructive">
                {error}
              </DropdownMenuLabel>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The first letter of a name, for an avatar with no photo. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}
