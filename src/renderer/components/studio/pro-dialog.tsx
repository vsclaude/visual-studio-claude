import { useState, type FormEvent, type ReactNode } from "react"
import {
  BadgeCheck,
  Check,
  Copy,
  Crown,
  Download,
  Minus,
  Monitor,
} from "lucide-react"

import {
  formatPrice,
  POPULAR_SEATS,
  PRO_PLANS,
  REFUND_DAYS,
} from "@shared/license"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { useStudioServer } from "@/lib/studio-server"
import { useT } from "@/lib/i18n"
import { usePro } from "@/lib/license"
import { cn } from "@/lib/utils"

/** Pro's own colours — the logo's violet-to-amber, on the crown, the buy
 * button and the title bar's `Upgrade`. Nothing else in the app uses the
 * gradient; that rarity is what makes it read. */
export const PRO_GRADIENT = "bg-linear-to-r from-violet-500 to-amber-400"

/**
 * Where this device stands, at the right of the title bar, opening the Pro
 * dialog. Nothing until main has answered, rather than `Upgrade` for a frame.
 *
 * On Free it is not a status but the one way in to Pro somebody sees all day,
 * so it says **Upgrade**, in the gradient, with the dialog's own crown and a
 * glint. On Pro, where there is nothing left to ask for, it drops to a quiet
 * violet outline — the way to the licence and its key.
 */
export function PlanBadge({ className }: { className?: string }) {
  const status = usePro((state) => state.status)
  const show = usePro((state) => state.show)
  const t = useT()
  if (!status) return null

  if (status.kind === "free") {
    return (
      <button
        type="button"
        onClick={show}
        title={t("nav.plan.freeTitle")}
        className={cn(
          "relative inline-flex h-6 shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-3 text-xs font-semibold whitespace-nowrap text-white shadow-md ring-1 shadow-violet-500/30 ring-white/20 transition-[filter,box-shadow] outline-none ring-inset hover:shadow-lg hover:shadow-violet-500/40 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring/50",
          PRO_GRADIENT,
          className
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-glint bg-linear-to-r from-transparent via-white/45 to-transparent"
        />
        <Crown className="relative size-3.5" />
        <span className="relative">{t("nav.plan.upgrade")}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={show}
      title={t("nav.plan.proTitle", { count: status.seats })}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap text-violet-600 outline -outline-offset-1 outline-violet-500/40 transition-colors hover:bg-violet-500/10 focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-violet-300",
        className
      )}
    >
      <Crown className="size-3.5" />
      {t("nav.plan.pro")}
    </button>
  )
}

/** The email a key was last sent to, so a second purchase or a restart does
 * not ask for it again. The renderer's own, like the theme's. */
const EMAIL_KEY = "vey.pro.email"

/**
 * The Pro dialog: Free beside the three device plans, which one this device
 * is on, and the ways in — a bank transfer through the server for this
 * device, or a key bought elsewhere pasted in. Side by side because the
 * difference from Free is one line (a second project) and the difference
 * between the plans is how many devices: a list of Pro's features alone read
 * as though the rest cost money. Mounted once per window and opened through
 * `usePro` — the title bar's `PlanBadge`, and a second `Add project` on Free.
 *
 * There is no sign-in. The purchase is for this device and an email the key
 * is mailed to; this window re-asks the server until the transfer lands
 * (`watchPro`). On Pro the dialog is the licence itself: who bought it, the
 * key to paste on another device, and taking this one off it.
 */
export function ProDialog() {
  const open = usePro((state) => state.open)
  const close = usePro((state) => state.close)
  const status = usePro((state) => state.status)
  const t = useT()
  const licensed = status?.kind === "licensed"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto p-0",
          licensed ? "sm:max-w-md" : "sm:max-w-5xl"
        )}
      >
        <div className="relative flex flex-col items-center gap-3 bg-linear-to-b from-violet-500/12 via-amber-400/6 to-transparent px-6 pt-7">
          <div
            aria-hidden
            className="absolute top-3 size-24 rounded-full bg-radial from-violet-400/25 to-transparent blur-xl"
          />
          <span className="relative flex size-12 animate-pop items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-amber-400 text-white shadow-lg shadow-violet-500/25">
            <Crown className="size-6" />
          </span>
          <DialogHeader className="relative items-center gap-1 text-center">
            <DialogTitle className="text-lg font-semibold">
              {t("projects.pro.title")}
            </DialogTitle>
            <DialogDescription className="max-w-md">
              {licensed
                ? t("projects.pro.licensedDescription")
                : t("projects.pro.description")}
            </DialogDescription>
          </DialogHeader>
        </div>

        {status?.kind === "licensed" ? <Licensed status={status} /> : <Plans />}
      </DialogContent>
    </Dialog>
  )
}

/** Free and the three plans, the email the key goes to, and the key field. */
function Plans() {
  const t = useT()
  const busy = usePro((state) => state.busy)
  const awaiting = usePro((state) => state.awaiting)
  const error = usePro((state) => state.error)
  const buy = usePro((state) => state.buy)
  const available = useStudioServer((state) => state.available)
  const [email, setEmail] = useState(
    () => localStorage.getItem(EMAIL_KEY) ?? ""
  )
  const [asked, setAsked] = useState(false)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const purchase = (seats: number) => {
    setAsked(true)
    if (!valid) {
      document.getElementById("pro-email")?.focus()
      return
    }
    localStorage.setItem(EMAIL_KEY, email.trim())
    void buy(seats, email.trim())
  }

  return (
    <div className="flex flex-col gap-5 px-6 pb-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Plan
          icon={Download}
          name={t("projects.pro.freeName")}
          price={formatPrice(0)}
          term={t("projects.pro.freeTerm")}
          sub={t("projects.pro.freeSub")}
          current
          items={[
            { text: t("projects.pro.freeAccounts") },
            { text: t("projects.pro.freeContinue") },
            { text: t("projects.pro.freeApi") },
            { text: t("projects.pro.freeProjects"), limit: true },
            { text: t("projects.pro.freeUpdates") },
          ]}
          index={0}
        />
        {PRO_PLANS.map((plan, index) => (
          <Plan
            key={plan.seats}
            pro
            popular={plan.seats === POPULAR_SEATS}
            icon={Monitor}
            name={t("projects.pro.devices", { count: plan.seats })}
            price={formatPrice(plan.price)}
            term={t("projects.pro.proTerm")}
            sub={t("projects.pro.devicesSub", { count: plan.seats })}
            items={[
              { text: t("projects.pro.proEverything") },
              { text: t("projects.pro.proProjects"), strong: true },
              { text: t("projects.pro.proWorktrees") },
              {
                text: t("projects.pro.proSeats", {
                  count: plan.seats,
                  days: REFUND_DAYS,
                }),
              },
            ]}
            index={index + 1}
          >
            {available && (
              <Button
                className={cn(
                  "w-full",
                  plan.seats === POPULAR_SEATS
                    ? "border-0 text-white shadow-sm shadow-violet-500/25 hover:opacity-90"
                    : "",
                  plan.seats === POPULAR_SEATS && PRO_GRADIENT
                )}
                variant={plan.seats === POPULAR_SEATS ? "default" : "outline"}
                disabled={busy}
                onClick={() => purchase(plan.seats)}
              >
                {t("projects.pro.buyDevices", { count: plan.seats })}
              </Button>
            )}
          </Plan>
        ))}
      </div>

      {available && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="pro-email" className="text-xs font-medium">
              {t("projects.pro.emailLabel")}
            </label>
            <Input
              id="pro-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={asked && !valid}
            />
            <p
              className={cn(
                "text-[0.6875rem]",
                asked && !valid ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {asked && !valid
                ? t("projects.pro.emailNeeded")
                : t("projects.pro.emailNote")}
            </p>
          </div>
          <KeyField />
        </div>
      )}

      {awaiting && !error && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          {t("projects.pro.waiting")}
        </p>
      )}
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      {available && (
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          {t("projects.pro.bankNote", { days: REFUND_DAYS })}
        </p>
      )}
    </div>
  )
}

/** A key bought on another device, or mailed to the buyer, pasted in. */
function KeyField() {
  const t = useT()
  const busy = usePro((state) => state.busy)
  const activate = usePro((state) => state.activate)
  const [key, setKey] = useState("")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (key.trim()) void activate(key.trim())
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor="pro-key" className="text-xs font-medium">
        {t("projects.pro.haveKey")}
      </label>
      <div className="flex gap-2">
        <Input
          id="pro-key"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="VEY-XXXX-XXXX-XXXX-XXXX"
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case"
        />
        <Button type="submit" variant="outline" disabled={busy || !key.trim()}>
          {t("projects.pro.activate")}
        </Button>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        {t("projects.pro.haveKeyNote")}
      </p>
    </form>
  )
}

/** On Pro: who bought it, how many devices, the key to copy to another, and
 * taking this device off it. */
function Licensed({
  status,
}: {
  status: { email: string; seats: number; key: string | null }
}) {
  const t = useT()
  const busy = usePro((state) => state.busy)
  const error = usePro((state) => state.error)
  const deactivate = usePro((state) => state.deactivate)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <p className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <BadgeCheck className="size-4 shrink-0" />
        {status.email
          ? t("projects.pro.statusLicensed", {
              email: status.email,
              count: status.seats,
            })
          : t("projects.pro.statusLicensedNoEmail", { count: status.seats })}
      </p>

      {status.key && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">
            {t("projects.pro.yourKey")}
          </span>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm tracking-wide">
              {status.key}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(status.key ?? "")
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            {t("projects.pro.yourKeyNote", { count: status.seats })}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t pt-4">
        {confirming ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs">{t("projects.pro.deactivateConfirm")}</p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void deactivate().then(() => setConfirming(false))
                }
              >
                {t("projects.pro.deactivate")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] text-muted-foreground">
              {t("projects.pro.deactivateNote")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setConfirming(true)}
            >
              {t("projects.pro.deactivate")}
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

/**
 * One plan's card. A device plan has Pro's violet ring and its buy button
 * under the list; the popular one is ringed in the gradient and flagged.
 * Free says it is the plan this device is on, since the badge that opened the
 * dialog is behind it.
 */
function Plan({
  pro = false,
  popular = false,
  icon: Icon,
  name,
  price,
  term,
  sub,
  current = false,
  items,
  index,
  children,
}: {
  pro?: boolean
  popular?: boolean
  icon: typeof Monitor
  name: string
  price: string
  term: string
  sub: string
  current?: boolean
  /** `limit` is Free's one line Pro lifts, drawn as a limit rather than a
   * tick; `strong` is the line that lifts it. */
  items: { text: string; limit?: boolean; strong?: boolean }[]
  index: number
  children?: ReactNode
}) {
  const t = useT()
  return (
    <div
      style={{ animationDelay: `${60 + index * 50}ms` }}
      className={cn(
        "relative flex animate-rise flex-col gap-4 rounded-xl p-4",
        popular
          ? "bg-card shadow-lg shadow-violet-500/15 outline-2 -outline-offset-2 outline-violet-500/70"
          : pro
            ? "border border-violet-500/25 bg-card"
            : "border bg-card/60"
      )}
    >
      {popular && (
        <span
          className={cn(
            "absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap text-white shadow-sm",
            PRO_GRADIENT
          )}
        >
          {t("projects.pro.popular")}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              pro && "text-violet-600 dark:text-violet-300"
            )}
          >
            <Icon className="size-3.5" />
            {name}
          </span>
          {current && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {t("projects.pro.current")}
            </span>
          )}
        </div>
        <p className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {price}
          </span>
          <span className="text-xs text-muted-foreground">{term}</span>
        </p>
        <p className="text-[0.6875rem] text-muted-foreground">{sub}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.text}
            className={cn(
              "flex items-start gap-2 text-xs leading-5",
              item.limit ? "text-muted-foreground" : "text-foreground",
              item.strong && "font-medium"
            )}
          >
            {item.limit ? (
              <Minus className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <Check
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  pro ? "text-violet-500" : "text-emerald-500"
                )}
              />
            )}
            {item.text}
          </li>
        ))}
      </ul>

      {children}
    </div>
  )
}
