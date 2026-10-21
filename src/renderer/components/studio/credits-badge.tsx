import { creditsLeft, type StudioAccount } from "@shared/credits"
import { VS_S, VS_SLANT, VS_V, VS_VIEWBOX } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/**
 * The credits' own colours, in one place.
 *
 * The violet-to-amber gradient means "this is about credits" and nothing else
 * in the app uses it — that rarity is what makes it read. It is drawn on the
 * badge that marks a paid choice, the bar that shows what is left, and the
 * buttons that buy more; anything else wanting attention should find another
 * way, or the colour stops meaning anything.
 */
export const CREDITS_GRADIENT = "bg-linear-to-br from-violet-500 to-amber-400"

/** A bar running out — the same warm-to-red the plan meter warns in. */
const LOW_GRADIENT = "bg-linear-to-r from-amber-500 to-red-500"
const BAR_GRADIENT = "bg-linear-to-r from-violet-500 to-amber-400"

/** A soft wash of the gradient behind a card, for the places that are about
 * credits as a whole (Settings, the refusal in a transcript). */
export const CREDITS_SURFACE =
  "border-violet-500/25 bg-linear-to-br from-violet-500/10 via-transparent to-amber-400/10"

/*
 * The coin's rim is an inset ring rather than a border, so the three sizes stay
 * exactly the box they were; at `xs` it is left off, since a 16px coin with a
 * rim is a grey ring round nothing.
 */
const BADGE_SIZES = {
  /** In a toolbar, beside a label. */
  xs: "size-4 shadow-sm shadow-violet-500/30 [&_svg]:size-2.5",
  /** A menu row's leading tile. */
  sm: "size-8 shadow-sm ring-2 shadow-violet-500/25 ring-white/25 ring-inset [&_svg]:size-4",
  /** A card's or a dialog's own mark. */
  md: "size-10 shadow-md ring-[3px] shadow-violet-500/25 ring-white/25 ring-inset [&_svg]:size-5",
} as const

/**
 * The credits' mark: a coin struck with the VS lettermark, white on the
 * gradient. A coin and not the app icon's rounded plate, so the two read apart
 * side by side — the plate is the app, the coin is what it runs on. It was a
 * lucide sparkle, which said "AI" in everybody's words rather than this app's.
 */
export function CreditsBadge({
  size = "sm",
  className,
}: {
  size?: keyof typeof BADGE_SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        CREDITS_GRADIENT,
        BADGE_SIZES[size],
        className
      )}
    >
      <VsGlyph className="translate-x-[-4%]" />
    </span>
  )
}

/**
 * The lettermark alone, in `currentColor` — `resources/vs-mark.svg` path for
 * path, sized by its caller. The nudge in `CreditsBadge` is the slant's: the
 * glyph's ink leans right, so its box's centre is not the eye's.
 */
export function VsGlyph({
  className,
  strokeWidth = 11,
}: {
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg viewBox={VS_VIEWBOX} fill="none" aria-hidden className={className}>
      <g
        transform={VS_SLANT}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={VS_V} />
        <path d={VS_S} />
      </g>
    </svg>
  )
}

/**
 * What is left of everything bought, as a bar that **empties**. The figure
 * that sells the next pack is the one running out, so it is the fill; a bar
 * filling up with what was spent reads as progress, which is the wrong thing
 * for a balance to feel like. Turns warm-to-red once `creditsLeft` says low.
 */
export function CreditsBar({
  account,
  className,
}: {
  account: StudioAccount
  /** The track's size — `h-1.5` across a card, `h-1 w-8` in a toolbar. */
  className?: string
}) {
  const { share, low } = creditsLeft(account)
  return (
    <span
      aria-hidden
      className={cn(
        "block overflow-hidden rounded-full bg-muted",
        className ?? "h-1.5"
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width]",
          low ? LOW_GRADIENT : BAR_GRADIENT
        )}
        style={{ width: `${Math.min(100, share * 100)}%` }}
      />
    </span>
  )
}
