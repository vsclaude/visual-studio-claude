import { Check, Coins, Crown, Leaf, Rocket, Sparkles, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  CREDIT_PACKS,
  CURRENT_PLAN,
  PLANS,
  planName,
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
import { usePlansDialog } from "@/lib/plans"
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

/**
 * The plan's name as a pill — the composer's Hobby row and the account menu
 * draw the same one the dialog does.
 */
export function PlanBadge({
  plan = CURRENT_PLAN,
  className,
}: {
  plan?: PlanId
  className?: string
}) {
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
 * The Upgrade dialog: the monthly plans and the credit packs, mounted once per
 * window and opened through `usePlansDialog`.
 *
 * Nothing here takes a payment yet — `shared/plans.ts` says why — so every
 * button but the current plan's is disabled and says so, rather than leading
 * somewhere that does not exist.
 */
export function PlansDialog() {
  const open = usePlansDialog((state) => state.open)
  const tab = usePlansDialog((state) => state.tab)
  const show = usePlansDialog((state) => state.show)
  const close = usePlansDialog((state) => state.close)

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

        <Tabs
          value={tab}
          onValueChange={(value) => show(value as "plans" | "credits")}
          className="items-center gap-5"
        >
          <TabsList>
            <TabsTrigger value="plans" className="px-3">
              Monthly plans
            </TabsTrigger>
            <TabsTrigger value="credits" className="px-3">
              Credits
            </TabsTrigger>
          </TabsList>

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
                    ${pack.price}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCredits(pack.credits)} credits
                  </span>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    disabled
                    title="Payments are not open yet"
                  >
                    Coming soon
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

        <p className="text-center text-[0.6875rem] text-muted-foreground">
          Payments are not open yet. Until they are, you stay on Hobby.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const look = LOOK[plan.id]
  const Icon = look.icon
  const current = plan.id === CURRENT_PLAN

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-card p-5",
        plan.highlight &&
          "border-violet-500/60 shadow-xl ring-1 shadow-violet-500/15 ring-violet-500/40"
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

      <div className="relative mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          ${plan.price}
        </span>
        <span className="text-xs text-muted-foreground">
          {plan.price === 0 ? "forever" : "/ month"}
        </span>
      </div>

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
            !current &&
            "bg-linear-to-r from-violet-500 to-amber-400 text-white hover:opacity-90"
        )}
        variant={current || !plan.highlight ? "outline" : "default"}
        disabled
        title={current ? undefined : "Payments are not open yet"}
      >
        {current ? "Your current plan" : `Get ${plan.name} — soon`}
      </Button>
    </div>
  )
}

function formatCredits(credits: number): string {
  return credits >= 1_000_000
    ? `${Number((credits / 1_000_000).toFixed(1))}M`
    : credits.toLocaleString()
}
