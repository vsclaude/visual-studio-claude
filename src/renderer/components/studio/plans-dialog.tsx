import {
  Check,
  Coins,
  CreditCard,
  Crown,
  ExternalLink,
  Landmark,
  Leaf,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  CREDIT_PACKS,
  MONTHS,
  PLANS,
  formatPrice,
  planName,
  priceFor,
  purchaseItem,
  type Months,
  type PaymentMethod,
  type Plan,
  type PlanId,
} from "@shared/plans"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFreeAi } from "@/lib/free-ai"
import { useCurrentPlan, usePlansDialog, useStudioAccount } from "@/lib/plans"
import { cn } from "@/lib/utils"

/**
 * The look of each plan, kept beside the dialog rather than in
 * `shared/plans.ts`: main has no business with Tailwind classes.
 */
const LOOK: Record<
  PlanId,
  { icon: LucideIcon; badge: string; glow: string; tint: string }
> = {
  hobby: {
    icon: Leaf,
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/20",
    tint: "text-emerald-500",
  },
  starter: {
    icon: Zap,
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    glow: "from-sky-500/20",
    tint: "text-sky-500",
  },
  plus: {
    icon: Rocket,
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    glow: "from-violet-500/25",
    tint: "text-violet-500",
  },
  pro: {
    icon: Crown,
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/20",
    tint: "text-amber-500",
  },
}

const METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: "bank", label: "Vietnamese bank · VietQR", icon: Landmark },
  { id: "card", label: "Card · international", icon: CreditCard },
]

/**
 * The plan's name as a pill — the composer's Hobby row and the account menu
 * draw the same one the dialog does.
 */
export function PlanBadge({
  plan,
  className,
}: {
  /** The signed-in user's own plan when left out. */
  plan?: PlanId
  className?: string
}) {
  const current = useCurrentPlan()
  plan ??= current
  const look = LOOK[plan]
  const Icon = look.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[0.625rem] font-medium",
        look.badge,
        className
      )}
    >
      <Icon className="size-2.5" />
      {planName(plan)}
    </span>
  )
}

/**
 * The Upgrade dialog: the plans and the credit packs, mounted once per window
 * and opened through `usePlansDialog`.
 *
 * Two ways to pay (`PaymentMethod`): a Vietnamese bank transfer by VietQR,
 * months up front, or a card through Paddle, renewed monthly. A buy button
 * asks main for the page (`buyPlanItem`), which opens in the browser; the plan
 * shown here changes when the server hears from SePay or Paddle, which
 * `useStudioAccount` re-asks about when the window takes focus back.
 */
export function PlansDialog() {
  const open = usePlansDialog((state) => state.open)
  const tab = usePlansDialog((state) => state.tab)
  const method = usePlansDialog((state) => state.method)
  const months = usePlansDialog((state) => state.months)
  const show = usePlansDialog((state) => state.show)
  const close = usePlansDialog((state) => state.close)
  const setMethod = usePlansDialog((state) => state.setMethod)
  const setMonths = usePlansDialog((state) => state.setMonths)
  const ready = useFreeAi((state) => state.ready)
  const account = useStudioAccount((state) => state.account)
  const pending = useStudioAccount((state) => state.pending)
  const error = useStudioAccount((state) => state.error)
  const buy = useStudioAccount((state) => state.buy)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto p-6 sm:max-w-5xl">
        <DialogHeader className="items-center text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-amber-400 text-white shadow-lg shadow-violet-500/25">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle className="text-xl font-semibold">
            Claude Code, without the $20 subscription
          </DialogTitle>
          <DialogDescription className="max-w-lg">
            Run Claude Code right here in the studio. Start on Hobby for free,
            pay for a plan that fits how much you use it, and top up with
            credits only when you need more.
          </DialogDescription>
        </DialogHeader>

        {account && <AccountStrip />}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Segmented
            value={method}
            onChange={setMethod}
            options={METHODS.map(({ id, label, icon: Icon }) => ({
              value: id,
              label: (
                <>
                  <Icon className="size-3.5" />
                  {label}
                </>
              ),
            }))}
          />
          <Tabs
            value={tab}
            onValueChange={(value) => show(value as "plans" | "credits")}
          >
            <TabsList>
              <TabsTrigger value="plans" className="px-3">
                Plans
              </TabsTrigger>
              <TabsTrigger value="credits" className="px-3">
                Credits
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === "plans" && method === "bank" && (
          <div className="flex justify-center">
            <Segmented
              value={months}
              onChange={setMonths}
              options={MONTHS.map((count) => ({
                value: count,
                label: (
                  <>
                    {count === 1 ? "1 month" : `${count} months`}
                    {count === 12 && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 text-[0.625rem] font-semibold text-emerald-600 dark:text-emerald-400">
                        2 free
                      </span>
                    )}
                  </>
                ),
              }))}
            />
          </div>
        )}

        <Tabs value={tab}>
          <TabsContent value="plans" className="w-full">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="credits" className="w-full">
            <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center"
                >
                  {pack.bonus && (
                    <span className="absolute -top-2.5 rounded-full bg-linear-to-r from-violet-500 to-amber-400 px-2 py-0.5 text-[0.625rem] font-semibold text-white">
                      +{pack.bonus}% bonus
                    </span>
                  )}
                  <Coins className="size-6 text-amber-500" />
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatPrice(pack.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCredits(pack.credits)} credits
                  </span>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={!ready || pending !== null}
                    onClick={() => void buy(pack.id, method)}
                  >
                    {pending === pack.id
                      ? "Opening…"
                      : ready
                        ? "Buy credits"
                        : "Sign in to buy"}
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Credits never expire and work on every plan, Hobby included — you
              pay for what you use, never a fixed monthly fee.
            </p>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-center text-xs text-destructive">{error}</p>
        )}
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          {method === "bank"
            ? "A page with the VietQR opens in your browser — scan it in your banking app. Plans are paid up front and do not renew; buy again to extend."
            : "Checkout opens in your browser and is handled by Paddle. Plans renew monthly until you cancel."}{" "}
          Your plan updates here a moment after the payment arrives.
        </p>
      </DialogContent>
    </Dialog>
  )
}

/** A row of buttons, one of them chosen — the method and the months. */
function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-[3px]">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-foreground/60 transition-colors hover:text-foreground",
            option.value === value &&
              "bg-background text-foreground shadow-sm dark:bg-input/30"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Where the user stands: today's allowance, the credits behind it, when a plan
 * runs out, and the way into Paddle's portal for a card subscription.
 */
function AccountStrip() {
  const account = useStudioAccount((state) => state.account)
  const pending = useStudioAccount((state) => state.pending)
  const manage = useStudioAccount((state) => state.manage)
  if (!account) return null

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3">
      <PlanBadge plan={account.plan} className="text-xs" />
      <div className="flex min-w-40 flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-linear-to-r from-violet-500 to-amber-400"
            style={{ width: `${Math.max(2, account.utilization)}%` }}
          />
        </div>
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {Math.round(account.utilization)}% of today
        </span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatCredits(account.credits)} credits
      </span>
      {account.prepaid && (
        <span className="text-xs text-muted-foreground">
          Paid until {formatDate(account.prepaid.until)}
        </span>
      )}
      {account.cancelsAt && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Ends {formatDate(account.cancelsAt)}
        </span>
      )}
      {account.subscribed && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void manage()}
        >
          {pending === "manage" ? "Opening…" : "Manage plan"}
          <ExternalLink />
        </Button>
      )}
    </div>
  )
}

type Action = { label: string; run: () => Promise<void>; busy: string } | null

/**
 * What a plan's button does, given how the user pays now and how they chose to
 * pay here. One plan at a time from one side: a card subscription is changed
 * in Paddle's portal, and a plan paid by transfer is extended — or switched,
 * with its days carried over by value — by another transfer; neither can be
 * bought on top of the other.
 */
function actionOf(input: {
  plan: Plan
  current: boolean
  method: PaymentMethod
  months: Months
  subscribed: boolean
  prepaid: { id: PlanId; until: string } | null
  buy: ReturnType<typeof useStudioAccount.getState>["buy"]
  manage: () => Promise<void>
}): Action | { label: string; disabled: true } {
  const { plan, method, months } = input
  if (plan.id === "hobby") {
    return {
      label: input.current ? "Your current plan" : "Included",
      disabled: true,
    }
  }
  const paid = plan.id
  const buy = (label: string): Action => {
    const item = purchaseItem(paid, method, months)
    return { label, run: () => input.buy(item, method), busy: item }
  }

  if (input.subscribed) {
    return input.current
      ? { label: "Your current plan", disabled: true }
      : { label: "Change in Manage plan", run: input.manage, busy: "manage" }
  }
  if (input.prepaid) {
    if (method === "card") {
      return {
        label: `Paid until ${formatDate(input.prepaid.until)}`,
        disabled: true,
      }
    }
    const span = months === 1 ? "1 month" : `${months} months`
    return input.prepaid.id === plan.id
      ? buy(`Extend ${span}`)
      : buy(`Switch to ${plan.name}`)
  }
  return buy(`Get ${plan.name}`)
}

function PlanCard({ plan }: { plan: Plan }) {
  const look = LOOK[plan.id]
  const Icon = look.icon
  const ready = useFreeAi((state) => state.ready)
  const currentPlan = useCurrentPlan()
  const method = usePlansDialog((state) => state.method)
  const months = usePlansDialog((state) => state.months)
  const subscribed = useStudioAccount(
    (state) => state.account?.subscribed ?? false
  )
  const prepaid = useStudioAccount((state) => state.account?.prepaid ?? null)
  const pending = useStudioAccount((state) => state.pending)
  const buy = useStudioAccount((state) => state.buy)
  const manage = useStudioAccount((state) => state.manage)
  const current = plan.id === currentPlan
  const action = actionOf({
    plan,
    current,
    method,
    months,
    subscribed,
    prepaid,
    buy,
    manage,
  })
  const runnable = action && !("disabled" in action) ? action : null

  // By transfer the card shows what is paid now for the months chosen; by card
  // it is the monthly charge.
  const upFront = method === "bank" && plan.price > 0 && months > 1
  const price = upFront ? priceFor(plan, months) : plan.price

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-card p-5",
        plan.highlight &&
          "border-violet-500/60 shadow-xl ring-1 shadow-violet-500/15 ring-violet-500/40",
        current && "ring-2 ring-emerald-500/50"
      )}
    >
      {/* A wash of the plan's colour behind the header, so the four cards
          read as four tiers at a glance rather than four copies of one. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b to-transparent",
          look.glow
        )}
      />
      {plan.highlight && (
        <span className="absolute top-3 right-3 rounded-full bg-linear-to-r from-violet-500 to-amber-400 px-2 py-0.5 text-[0.625rem] font-semibold text-white">
          Most popular
        </span>
      )}

      <div className="relative flex items-center gap-2">
        <Icon className={cn("size-5", look.tint)} />
        <span className="text-base font-semibold">{plan.name}</span>
      </div>
      <p className="relative mt-1 min-h-8 text-xs text-muted-foreground">
        {plan.tagline}
      </p>

      <div className="relative mt-3 flex flex-wrap items-baseline gap-x-1">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {formatPrice(price)}
        </span>
        <span className="text-xs text-muted-foreground">
          {plan.price === 0
            ? "forever"
            : upFront
              ? `for ${months} months`
              : "/ month"}
        </span>
      </div>
      {upFront && (
        <p className="relative text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatPrice(Math.round(price / months))} a month
        </p>
      )}

      <div className="relative mt-3 flex flex-wrap gap-1">
        {plan.models.map((model) => (
          <span
            key={model}
            className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground"
          >
            {model}
          </span>
        ))}
      </div>

      <ul className="relative mt-4 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-xs">
            <Check className={cn("mt-px size-3.5 shrink-0", look.tint)} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        className={cn(
          "relative mt-5 w-full",
          plan.highlight &&
            runnable &&
            "bg-linear-to-r from-violet-500 to-amber-400 text-white hover:opacity-90"
        )}
        variant={runnable && plan.highlight ? "default" : "outline"}
        disabled={!runnable || !ready || pending !== null}
        onClick={() => void runnable?.run()}
      >
        {!action
          ? "Included"
          : runnable && pending === runnable.busy
            ? "Opening…"
            : runnable && !ready
              ? "Sign in to buy"
              : action.label}
      </Button>
    </div>
  )
}

function formatCredits(credits: number): string {
  return credits >= 1_000_000
    ? `${Number((credits / 1_000_000).toFixed(1))}M`
    : credits.toLocaleString()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}
