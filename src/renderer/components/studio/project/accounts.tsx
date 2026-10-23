import { useEffect, useRef, useState, type PointerEvent } from "react"
import {
  ChevronRight,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react"

import { formatCredits } from "@shared/credits"
import { FREE_PROFILE_ID } from "@shared/free-ai"
import type { ClaudeProfile, PlanUsage } from "@shared/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAccount } from "@/lib/account"
import {
  accountCaption,
  accountLabel,
  nextProfileName,
  useClaudeProfiles,
} from "@/lib/chat/claude-profiles"
import { avatarHue, avatarLetter, type AccountChoice } from "@/lib/chat/column"
import {
  percent,
  resetLabel,
  usageTone,
  usePlanUsage,
} from "@/lib/chat/plan-usage"
import { useChats } from "@/lib/chat/store"
import { useCreditsDialog, useStudioAccount } from "@/lib/credits"
import { useFreeAi } from "@/lib/free-ai"
import { useSettings } from "@/lib/settings"
import { ClaudeLoginDialog } from "../claude-login-dialog"
import { CreditsBadge } from "../credits-badge"
import { IconButton } from "../icon-button"

/**
 * The accounts a chat can run on, in the order the column lists them: the
 * login the user's own `claude` already has, then their profiles, then credits
 * — the plan somebody is already paying for ahead of the one that costs per
 * turn. Each with what the column knows of whether it can take a turn.
 */
export type ColumnAccount = AccountChoice & { name: string }

export function useColumnAccounts(): ColumnAccount[] {
  const profiles = useClaudeProfiles((state) => state.profiles)
  const accounts = useClaudeProfiles((state) => state.accounts)
  const usage = usePlanUsage((state) => state.byProfile)
  const freeReady = useFreeAi((state) => state.ready)
  const credits = useStudioAccount((state) => state.account?.credits)

  // An account nobody has checked is `usable`: not knowing is not the same as
  // signed out, and a turn sent to one that is says so itself.
  const signedIn = (configDir: string) => {
    const state = accounts[configDir.trim()]?.state
    return state === undefined || state === "signedIn"
  }

  const list: ColumnAccount[] = [
    {
      profileId: null,
      name: "This account",
      utilization: fiveHour(usage[""]),
      usable: signedIn(""),
    },
    ...profiles.map((profile) => ({
      profileId: profile.id,
      name: profile.name,
      utilization: fiveHour(usage[profile.id]),
      usable: profile.configDir.trim() !== "" && signedIn(profile.configDir),
    })),
  ]
  if (freeReady) {
    list.push({
      profileId: FREE_PROFILE_ID,
      name: "Credits",
      utilization: null,
      usable: credits === undefined || credits > 0,
    })
  }
  return list
}

/** The five-hour window's percent, or null when there is none to read. */
function fiveHour(usage: PlanUsage | undefined): number | null {
  if (!usage?.available) return null
  return (
    usage.windows.find((window) => window.id === "five_hour")?.utilization ??
    null
  )
}

/** What the column calls an account — the picker's own names. */
export function useAccountName(profileId: string | null): string {
  const profiles = useClaudeProfiles((state) => state.profiles)
  if (profileId === null) return "This account"
  if (profileId === FREE_PROFILE_ID) return "Credits"
  return (
    profiles.find((profile) => profile.id === profileId)?.name ?? "This account"
  )
}

/**
 * Which account a chat runs on, as a small round mark on its row.
 *
 * The thing the column never said: this app is for running chats on several
 * accounts, and which one a chat is spending was only in its composer's
 * toolbar. A letter in a hue per profile, the credits coin for credits, and a
 * person for the user's own login — and a profile that has since been deleted
 * reads as that login, which is what `chat.ts` falls back to as well.
 */
export function AccountAvatar({
  profileId,
  className,
}: {
  profileId: string | null
  className?: string
}) {
  const profiles = useClaudeProfiles((state) => state.profiles)
  const name = useAccountName(profileId)

  if (profileId === FREE_PROFILE_ID) {
    return <CreditsBadge size="xs" className={className} />
  }
  const profile = profiles.find((entry) => entry.id === profileId)
  if (!profile) {
    return (
      <span
        aria-hidden
        title={name}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
          className
        )}
      >
        <UserRound className="size-2.5" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      title={name}
      style={{ backgroundColor: `oklch(0.62 0.13 ${avatarHue(profile.id)})` }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full text-[0.5625rem] leading-none font-semibold text-white",
        className
      )}
    >
      {avatarLetter(profile.name)}
    </span>
  )
}

/** A login dialog's subject: which directory, under which name, and whose
 * plan usage to re-read once it closes. */
type LoginTarget = {
  profileId: string | null
  configDir: string
  name: string
}

/**
 * The foot of the projects column: every account, how much of its five-hour
 * window is gone, and the credits left — and where accounts are **managed**.
 *
 * The question the product exists to answer — which account can still take a
 * turn — asked of every account at once, where it used to be asked of one at a
 * time in each chat's composer. Main holds a minute per account, so asking on
 * mount and again whenever a turn ends anywhere is cheap; an account with no
 * plan window (an API key) is listed without a bar rather than with an empty
 * one, which would be claiming a measurement nobody made.
 *
 * It replaced Settings › Claude. That section held the same list, and the one
 * thing anybody did there — sign a profile in after seeing it was not — was a
 * dialog away from where `Not signed in` was being read. So the row is the
 * control: `Sign in` on the line that says it is not, the rest (check again,
 * rename, remove) on a click or a right-click, and `+` beside the heading,
 * which goes straight on to the login because a profile nobody signed into is
 * a row saying `Not signed in`.
 */
export function AccountsFooter() {
  const accounts = useColumnAccounts()
  const usage = usePlanUsage((state) => state.byProfile)
  const load = usePlanUsage((state) => state.load)
  const profiles = useClaudeProfiles((state) => state.profiles)
  const checkUnknown = useClaudeProfiles((state) => state.checkUnknown)
  const create = useClaudeProfiles((state) => state.create)
  const remove = useClaudeProfiles((state) => state.remove)
  const credits = useStudioAccount((state) => state.account?.credits)
  const freeReady = useFreeAi((state) => state.ready)
  const busy = useChats((state) => state.sending.length)

  const [renaming, setRenaming] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ClaudeProfile | null>(null)
  const [loggingIn, setLoggingIn] = useState<LoginTarget | null>(null)
  // A profile just added, waiting on main to name its directory — one round
  // trip (`save` in `lib/chat/claude-profiles.ts`). Its login opens the
  // moment there is one: an empty `CLAUDE_CONFIG_DIR` is the *default* login,
  // and signing that in under the new profile's name would be signing in the
  // wrong account.
  const [adding, setAdding] = useState<string | null>(null)
  const added = profiles.find((profile) => profile.id === adding)
  const login: LoginTarget | null =
    loggingIn ??
    (added?.configDir.trim()
      ? { profileId: added.id, configDir: added.configDir, name: added.name }
      : null)

  const collapsed = useSettings((state) => state.accountsCollapsed)
  const setCollapsed = useSettings((state) => state.setAccountsCollapsed)
  const {
    foot,
    height: footHeight,
    dragging,
    start: startResize,
    move: moveResize,
    end: endResize,
    reset: resetResize,
  } = useFootResize()

  const add = () => {
    create(nextProfileName(profiles.length))
    setAdding(useClaudeProfiles.getState().profiles.at(-1)?.id ?? null)
    // The row it adds has to be seen to be signed in afterwards.
    if (collapsed) setCollapsed(false)
  }

  const plans = accounts
    .map((account) => account.profileId)
    .filter((id) => id !== FREE_PROFILE_ID)
  const plansKey = plans.join("|")

  useEffect(() => {
    checkUnknown(["", ...profiles.map((profile) => profile.configDir)])
  }, [checkUnknown, profiles])

  // `plansKey` rather than `plans`, which is a new array every render.
  useEffect(() => {
    for (const id of plansKey.split("|")) void load(id === "" ? null : id)
  }, [load, plansKey])

  // And again each time a turn ends anywhere — the moment a number moved.
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (busy < wasBusy.current) {
      for (const id of plansKey.split("|")) void load(id === "" ? null : id)
    }
    wasBusy.current = busy
  }, [busy, load, plansKey])

  const now = new Date()

  return (
    // Capped at a share of the column, the list scrolling under its heading:
    // eight profiles drawn whole pushed the chats — what the column is for —
    // into a strip at the top. The heading stays put so `+` is always there.
    // Dragged to a height of its own it may take more, never all of it.
    <div
      ref={foot}
      // A ceiling rather than a height: a foot dragged taller than its rows
      // would draw empty space under them, and one with fewer rows than when
      // it was dragged still fits them.
      style={
        collapsed || footHeight === null
          ? undefined
          : { maxHeight: `min(${footHeight}px, ${FOOT_MAX_SHARE * 100}%)` }
      }
      className={cn(
        "relative flex shrink-0 flex-col border-t px-2 pt-1.5",
        collapsed ? "pb-1.5" : "pb-2",
        !collapsed && footHeight === null && "max-h-[50%]"
      )}
    >
      {!collapsed && (
        // Straddling the top border, the composer's handle: found by aiming
        // at the edge, and a double-click gives the foot back its own height.
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize accounts"
          title="Drag to resize, double-click to reset"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={resetResize}
          className="group absolute inset-x-0 -top-1.5 z-10 flex h-3 cursor-ns-resize items-center"
        >
          <span
            className={cn(
              "h-0.5 w-full transition-colors group-hover:bg-ring/60",
              dragging && "bg-ring/60"
            )}
          />
        </div>
      )}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between pr-0.5",
          !collapsed && "mb-0.5"
        )}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 rounded-sm py-0.5 pr-1 pl-0.5 text-[0.625rem] font-medium tracking-wider text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform",
              !collapsed && "rotate-90"
            )}
          />
          Accounts
        </button>
        <IconButton label="Add account" className="size-6" onClick={add}>
          <Plus />
        </IconButton>
      </div>
      <ul
        className={cn("min-h-0 flex-1 overflow-y-auto", collapsed && "hidden")}
      >
        {accounts.map((account) => {
          const key = account.profileId ?? ""
          const plan = usage[key]
          const window = plan?.available
            ? plan.windows.find((entry) => entry.id === "five_hour")
            : undefined
          const tone = window ? usageTone(window.utilization) : "ok"
          const reset = window ? resetLabel(window.resetsAt, now) : null

          if (account.profileId === FREE_PROFILE_ID) {
            return (
              <CreditsRow
                key={key}
                label={
                  credits !== undefined ? `${formatCredits(credits)} left` : ""
                }
                broke={!account.usable}
              />
            )
          }

          const profile = profiles.find(
            (entry) => entry.id === account.profileId
          )
          return (
            <PlanRow
              key={key}
              account={account}
              configDir={profile?.configDir ?? ""}
              renaming={renaming === key}
              status={
                window
                  ? `${percent(window.utilization)}${reset ? ` · ${reset}` : ""}`
                  : ""
              }
              tone={tone}
              utilization={window?.utilization ?? null}
              onLogin={() =>
                setLoggingIn({
                  profileId: account.profileId,
                  configDir: profile?.configDir ?? "",
                  name: account.name,
                })
              }
              onRename={() => setRenaming(key)}
              onRenamed={() => setRenaming(null)}
              onRemove={profile ? () => setRemoving(profile) : undefined}
            />
          )
        })}
        {/* Credits are listed as an account only once they can take a turn
            (`useColumnAccounts`, which `Continue with …` reads too); until
            then the row is the way in, which Settings used to be. */}
        {!freeReady && <CreditsRow label="" broke={false} signIn />}
      </ul>

      {login && (
        <ClaudeLoginDialog
          configDir={login.configDir}
          name={login.name}
          onClose={() => {
            setLoggingIn(null)
            setAdding(null)
            // `fresh`: main holds an answer a minute, and the one it holds is
            // from before the login.
            void load(login.profileId, true)
          }}
        />
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Chats that ran on it run on This account from their next message.
              Its login directory is left on disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) remove(removing.id)
                setRemoving(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** The foot's own floor: its heading and one row, so a drag never leaves a
 * heading over nothing — folding it is what that is for. */
const FOOT_MIN = 72

/** How much of the column a dragged foot may take: the chats keep the rest. */
const FOOT_MAX_SHARE = 0.9

/**
 * Dragging the foot's top edge, the composer's way: held here while dragging
 * and written once on release, since every write is the whole settings bag.
 */
function useFootResize() {
  const saved = useSettings((state) => state.accountsHeight)
  const save = useSettings((state) => state.setAccountsHeight)
  const foot = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; height: number; max: number } | null>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  return {
    foot,
    height: dragHeight ?? saved,
    dragging: dragHeight !== null,
    start(event: PointerEvent<HTMLDivElement>) {
      const element = foot.current
      if (event.button !== 0 || !element) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const column = element.parentElement?.clientHeight ?? window.innerHeight
      // No taller than every row shown: past that the edge would stop
      // following the pointer, and the height saved would be a lie.
      const list = element.querySelector("ul")
      const whole = list
        ? element.offsetHeight - list.clientHeight + list.scrollHeight
        : element.offsetHeight
      drag.current = {
        y: event.clientY,
        height: element.offsetHeight,
        max: Math.max(FOOT_MIN, Math.min(whole, column * FOOT_MAX_SHARE)),
      }
    },
    move(event: PointerEvent<HTMLDivElement>) {
      const current = drag.current
      if (!current) return
      const next = current.height + current.y - event.clientY
      setDragHeight(Math.round(Math.min(current.max, Math.max(FOOT_MIN, next))))
    },
    end() {
      if (!drag.current) return
      drag.current = null
      if (dragHeight !== null) save(dragHeight)
      setDragHeight(null)
    },
    reset() {
      save(null)
    },
  }
}

/** Tailwind for an account row — a button the width of the column, with the
 * hover every row in the column has. */
const ROW =
  "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-accent/60"

/**
 * One login — the user's own or a profile: its name, its five-hour window, and
 * a menu on a click or a right-click.
 *
 * `Sign in` stands on the row itself rather than in the menu when the account
 * is not signed in, since that line is the one place the problem is read and
 * there is nothing else to do with such a row. It is a sibling of the row's
 * button, not inside it: a button in a button is neither valid nor clickable.
 */
function PlanRow({
  account,
  configDir,
  renaming,
  status,
  tone,
  utilization,
  onLogin,
  onRename,
  onRenamed,
  onRemove,
}: {
  account: ColumnAccount
  configDir: string
  renaming: boolean
  status: string
  tone: ReturnType<typeof usageTone>
  utilization: number | null
  onLogin: () => void
  onRename: () => void
  onRenamed: () => void
  /** Absent for the user's own login, which is `~/.claude` and not ours. */
  onRemove?: () => void
}) {
  const key = configDir.trim()
  const known = useClaudeProfiles((state) => state.accounts[key])
  const checking = useClaudeProfiles((state) => state.checking.includes(key))
  const check = useClaudeProfiles((state) => state.check)
  const rename = useClaudeProfiles((state) => state.rename)
  const load = usePlanUsage((state) => state.load)
  const [open, setOpen] = useState(false)

  // A profile whose directory main has not named yet has nothing to check
  // or sign in — the empty key is the *default* login's.
  const settingUp = account.profileId !== null && !key
  const caption = accountCaption(known)
  const signedIn = known?.state === "signedIn"

  return (
    <li>
      <div className="flex items-center gap-1">
        {renaming && account.profileId ? (
          <div className={cn(ROW, "hover:bg-transparent")}>
            <AccountAvatar profileId={account.profileId} />
            <InlineName
              name={account.name}
              onDone={(name) => {
                if (name && name !== account.name) {
                  rename(account.profileId!, name)
                }
                onRenamed()
              }}
            />
          </div>
        ) : (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={caption || undefined}
                  className={ROW}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setOpen(true)
                  }}
                />
              }
            >
              <AccountAvatar profileId={account.profileId} />
              <span className="min-w-0 flex-1 truncate">{account.name}</span>
              {account.usable && !settingUp && (
                <span
                  className={cn(
                    "shrink-0 text-[0.6875rem] tabular-nums",
                    tone === "high"
                      ? "text-destructive"
                      : tone === "warn"
                        ? "text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground"
                  )}
                >
                  {checking ? "Checking…" : status}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <p className="truncate px-1.5 py-1 text-xs text-muted-foreground">
                {caption || accountLabel(known).label}
              </p>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={settingUp} onClick={onLogin}>
                <KeyRound />
                {signedIn ? "Sign in as another account…" : "Sign in…"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={settingUp || checking}
                onClick={() => {
                  void check(key)
                  void load(account.profileId, true)
                }}
              >
                <RefreshCw />
                Check again
              </DropdownMenuItem>
              {onRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRename}>
                    <Pencil />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={onRemove}>
                    <Trash2 />
                    Remove…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {settingUp ? (
          <span className="shrink-0 pr-1 text-[0.6875rem] text-muted-foreground">
            Setting up…
          </span>
        ) : (
          !account.usable &&
          !renaming && (
            <Button
              size="xs"
              variant="ghost"
              className="shrink-0 text-destructive hover:text-destructive"
              title="Not signed in"
              onClick={onLogin}
            >
              Sign in
            </Button>
          )
        )}
      </div>
      {utilization !== null && (
        <div
          aria-hidden
          className="mr-1 mb-1 ml-7 h-1 overflow-hidden rounded-full bg-border"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "high"
                ? "bg-destructive"
                : tone === "warn"
                  ? "bg-amber-500"
                  : "bg-foreground/50"
            )}
            style={{ width: `${utilization}%` }}
          />
        </div>
      )}
    </li>
  )
}

/**
 * Credits as a row: the balance, and a click to buy more — or, for somebody
 * not signed in to Vey Studio, `Sign in`, the way in Settings' Credits card
 * used to be.
 */
function CreditsRow({
  label,
  broke,
  signIn = false,
}: {
  label: string
  broke: boolean
  signIn?: boolean
}) {
  const showCredits = useCreditsDialog((state) => state.show)
  const busy = useAccount((state) => state.busy)
  const start = useAccount((state) => state.signIn)

  if (signIn) {
    return (
      <li className="flex items-center gap-1">
        <div className={cn(ROW, "hover:bg-transparent")}>
          <CreditsBadge size="xs" />
          <span className="min-w-0 flex-1 truncate">Credits</span>
        </div>
        <Button
          size="xs"
          variant="ghost"
          className="shrink-0"
          title="Every model, paid as you go — never a monthly fee"
          disabled={busy}
          onClick={() => void start()}
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        className={ROW}
        title="Buy credits"
        onClick={showCredits}
      >
        <CreditsBadge size="xs" />
        <span className="min-w-0 flex-1 truncate">Credits</span>
        <span
          className={cn(
            "shrink-0 text-[0.6875rem] tabular-nums",
            broke ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </button>
    </li>
  )
}

/** A profile's name as a field, in place: Enter or a click away keeps it,
 * Escape leaves it as it was — the column's other renames. */
function InlineName({
  name,
  onDone,
}: {
  name: string
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(name)
  const settled = useRef(false)
  const finish = (next: string | null) => {
    if (settled.current) return
    settled.current = true
    onDone(next)
  }

  return (
    <input
      autoFocus
      aria-label="Account name"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => finish(value.trim() || null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(value.trim() || null)
        if (event.key === "Escape") finish(null)
      }}
      className="h-5 min-w-0 flex-1 rounded-sm border bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  )
}
