import { useEffect, useState } from "react"
import { Coins, CreditCard, Landmark, Sparkle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  CREDIT_PACKS,
  formatCredits,
  formatPrice,
  type PaymentMethod,
} from "@shared/credits"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useCreditsDialog, useStudioAccount } from "@/lib/credits"
import { useFreeAi } from "@/lib/free-ai"
import { cn } from "@/lib/utils"

const METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: "bank", label: "Vietnamese bank · VietQR", icon: Landmark },
  { id: "card", label: "Card · international", icon: CreditCard },
]

/**
 * The credits dialog: the packs and where the user stands, mounted once per
 * window and opened through `useCreditsDialog`.
 *
 * Two ways to pay (`PaymentMethod`): a Vietnamese bank transfer by VietQR, or
 * a card through Paddle. A buy button asks main for the page (`buyCredits`),
 * which opens in the browser; the balance shown here changes when the server
 * hears from SePay or Paddle, which `useStudioAccount` watches for after a
 * checkout opens — and when it lands, `CreditsArrived` says so.
 */
export function CreditsDialog() {
  return (
    <>
      <BuyDialog />
      <CreditsArrived />
    </>
  )
}

function BuyDialog() {
  const open = useCreditsDialog((state) => state.open)
  const method = useCreditsDialog((state) => state.method)
  const close = useCreditsDialog((state) => state.close)
  const setMethod = useCreditsDialog((state) => state.setMethod)
  const ready = useFreeAi((state) => state.ready)
  const account = useStudioAccount((state) => state.account)
  const pending = useStudioAccount((state) => state.pending)
  const awaiting = useStudioAccount((state) => state.awaiting)
  const error = useStudioAccount((state) => state.error)
  const buy = useStudioAccount((state) => state.buy)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto p-6 sm:max-w-3xl">
        <DialogHeader className="items-center text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-amber-400 text-white shadow-lg shadow-violet-500/25">
            <Coins className="size-5" />
          </span>
          <DialogTitle className="text-xl font-semibold">
            Buy credits
          </DialogTitle>
          <DialogDescription className="max-w-lg">
            Credits pay for every model as you use it — never a monthly fee.
          </DialogDescription>
        </DialogHeader>

        {account && <AccountStrip />}

        <div className="flex justify-center">
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
        </div>

        <div className="grid gap-3 pt-1 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center",
                // Taller than its neighbours rather than scaled, so it cannot
                // spill past the dialog's scroll box sideways.
                pack.popular &&
                  "border-violet-500/60 bg-linear-to-b from-violet-500/10 to-card shadow-lg ring-1 shadow-violet-500/15 ring-violet-500/40 sm:-my-2 sm:py-7"
              )}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-violet-500 to-amber-400 px-2.5 py-0.5 text-[0.625rem] font-semibold text-white shadow-sm">
                  <Sparkle className="size-2.5 fill-current" />
                  Most popular
                </span>
              )}
              <Coins
                className={cn(
                  "size-6 text-amber-500",
                  pack.popular && "size-7"
                )}
              />
              <span className="text-2xl font-semibold tabular-nums">
                {formatPrice(pack.price)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCredits(pack.credits)} credits
              </span>
              {pack.bonus && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.625rem] font-semibold text-amber-600 dark:text-amber-400">
                  +{pack.bonus}% bonus
                </span>
              )}
              <Button
                variant={pack.popular ? "default" : "outline"}
                className={cn(
                  "mt-auto w-full",
                  pack.popular &&
                    "bg-linear-to-r from-violet-500 to-amber-400 text-white hover:opacity-90"
                )}
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

        {awaiting && !error && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            Waiting for your payment — this window will tell you the moment it
            lands.
          </p>
        )}
        {error && (
          <p className="text-center text-xs text-destructive">{error}</p>
        )}
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          {method === "bank"
            ? "A page with the VietQR opens in your browser — scan it in your banking app."
            : "Checkout opens in your browser and is handled by Paddle."}{" "}
          Credits never expire, and show up here a moment after the payment
          arrives.
        </p>
      </DialogContent>
    </Dialog>
  )
}

/** A row of buttons, one of them chosen — the payment method. */
function Segmented<T extends string>({
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
          key={option.value}
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
 * The credits, used and left — a balance with nothing beside it does not say
 * whether a pack lasted a week or an afternoon.
 */
function AccountStrip() {
  const account = useStudioAccount((state) => state.account)
  if (!account) return null

  const total = account.creditsUsed + account.credits
  return (
    <div className="rounded-xl border bg-muted/40 px-4 py-3">
      <Meter
        title="Credits"
        fraction={total > 0 ? account.creditsUsed / total : 0}
        bar="from-amber-500 to-amber-400"
        used={`${formatCredits(account.creditsUsed)} used`}
        aside={`${formatCredits(account.credits)} left`}
        strong
      />
    </div>
  )
}

function Meter(props: {
  title: string
  fraction: number
  bar: string
  used: string
  aside: string
  /** Draws `aside` as the figure that matters — the credits left. */
  strong?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium">{props.title}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-linear-to-r", props.bar)}
          style={{
            width: `${Math.min(100, Math.max(2, props.fraction * 100))}%`,
          }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span className="truncate">{props.used}</span>
        <span
          className={cn(
            "whitespace-nowrap",
            props.strong && "font-medium text-foreground"
          )}
        >
          {props.aside}
        </span>
      </div>
    </div>
  )
}

/**
 * The moment a purchase lands: a coin dropping in with smaller ones thrown
 * out from behind it, the amount counting up, and the new balance — so
 * somebody who paid in a browser or on a phone sees, when they come back,
 * that the money arrived and what it bought. Opened by `arrived` in
 * `useStudioAccount`, which only the window that opened the checkout sets.
 */
function CreditsArrived() {
  const arrived = useStudioAccount((state) => state.arrived)
  const dismiss = useStudioAccount((state) => state.dismissArrival)
  const counted = useCountUp(arrived?.added ?? 0)

  // The packs have done their job; the celebration replaces them rather than
  // stacking a second dialog over the first.
  useEffect(() => {
    if (arrived) useCreditsDialog.getState().close()
  }, [arrived])

  return (
    <Dialog
      open={arrived !== null}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <CoinBurst />
        <div className="flex flex-col items-center gap-1.5 px-6 pt-2 pb-6 text-center">
          <DialogHeader className="items-center gap-1 text-center">
            <DialogTitle className="text-lg font-semibold">
              Credits added
            </DialogTitle>
            <DialogDescription>
              Your payment arrived — thank you.
            </DialogDescription>
          </DialogHeader>
          <span className="mt-3 bg-linear-to-r from-violet-500 to-amber-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent tabular-nums">
            +{formatCredits(counted)}
          </span>
          <span className="text-xs text-muted-foreground">credits</span>
          {arrived && (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Your balance is now{" "}
              <b className="font-semibold text-foreground tabular-nums">
                {formatCredits(arrived.balance)}
              </b>{" "}
              credits. They never expire.
            </p>
          )}
          <Button
            className="mt-5 w-full bg-linear-to-r from-violet-500 to-amber-400 text-white hover:opacity-90"
            onClick={dismiss}
          >
            Back to work
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Where the six small coins come to rest around the big one, and when. */
const SCATTER = [
  { x: -78, y: -18, size: 22, delay: 140 },
  { x: 74, y: -26, size: 18, delay: 200 },
  { x: -58, y: 34, size: 16, delay: 260 },
  { x: 64, y: 30, size: 20, delay: 180 },
  { x: -18, y: -52, size: 14, delay: 320 },
  { x: 30, y: 50, size: 12, delay: 380 },
]

const SPARKS = [
  { left: "18%", top: "22%", size: 14, delay: 0 },
  { left: "80%", top: "18%", size: 18, delay: 600 },
  { left: "12%", top: "70%", size: 12, delay: 1100 },
  { left: "86%", top: "66%", size: 14, delay: 300 },
  { left: "50%", top: "8%", size: 10, delay: 900 },
]

/**
 * The illustration: drawn here rather than shipped as a picture, so it takes
 * the theme's colours in light and dark and its parts can move one by one.
 */
function CoinBurst() {
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden bg-linear-to-b from-violet-500/15 via-amber-400/10 to-transparent">
      <div
        aria-hidden
        className="absolute size-36 animate-halo rounded-full bg-radial from-amber-300/50 via-violet-400/20 to-transparent blur-md"
      />
      {SPARKS.map((spark, index) => (
        <Sparkle
          key={index}
          aria-hidden
          className="absolute animate-twinkle fill-amber-300 text-amber-400"
          style={{
            left: spark.left,
            top: spark.top,
            width: spark.size,
            height: spark.size,
            animationDelay: `${spark.delay}ms`,
          }}
        />
      ))}
      {SCATTER.map((coin, index) => (
        <span
          key={index}
          aria-hidden
          className="absolute animate-scatter"
          style={{
            transform: `translate(${coin.x}px, ${coin.y}px)`,
            animationDelay: `${coin.delay}ms`,
          }}
        >
          <Coin size={coin.size} />
        </span>
      ))}
      <span className="relative animate-coin-land drop-shadow-[0_10px_18px_rgba(245,158,11,0.35)]">
        <Coin size={84} big />
      </span>
    </div>
  )
}

/** A gold coin: a rim, a face, a shine, and on the big one a star. */
function Coin({ size, big = false }: { size: number; big?: boolean }) {
  const id = big ? "coin-big" : "coin-small"
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-rim)`} />
      <circle cx="32" cy="32" r="23" fill={`url(#${id}-face)`} />
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke="#d97706"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {big && (
        <path
          d="M32 19l3.6 8.2 8.9.8-6.7 5.9 2 8.7L32 38.1l-7.8 4.5 2-8.7-6.7-5.9 8.9-.8z"
          fill="#d97706"
          fillOpacity="0.85"
        />
      )}
      <path
        d="M17 24a17 17 0 0 1 12-9"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * `target`, counted up from zero over most of a second — the amount arriving
 * rather than appearing. Straight to it when motion is reduced.
 */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (
      target <= 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target)
      return
    }
    const started = performance.now()
    const duration = 900
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - started) / duration)
      // Ease out: most of the number at once, the last digits settling.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}
