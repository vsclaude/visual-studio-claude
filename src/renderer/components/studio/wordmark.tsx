import { useId, type CSSProperties } from "react"

import { cn } from "@/lib/utils"

/**
 * "VS Claude" as the brand writes it: the VS lettermark, then "Claude" in the
 * surrounding type. The lettermark is `resources/vs-mark.svg`, path for path —
 * the S runs through the V's right arm, so the two read as one glyph, the same
 * one the app icon draws in white.
 *
 * Sized in `em` and sat on the baseline, so it is the cap height of whatever
 * text it is set in and needs no size of its own. The gradient id is per
 * instance: two wordmarks on one screen (the splash under the setup) would
 * otherwise both point at whichever `<linearGradient>` came first.
 */
export function Wordmark({
  className,
  textClassName,
  style,
}: {
  className?: string
  style?: CSSProperties
  /** For "Claude" alone — the splash's faded gradient text, say. */
  textClassName?: string
}) {
  const ink = `vs-ink-${useId().replace(/:/g, "")}`
  return (
    <span
      className={cn("inline-flex items-baseline gap-[0.22em]", className)}
      style={style}
      aria-label="VS Claude"
      role="img"
    >
      <svg
        viewBox="8.85 -0.05 64.5 60.1"
        fill="none"
        aria-hidden
        className="h-[0.86em] w-auto shrink-0 self-baseline"
      >
        <defs>
          <linearGradient
            id={ink}
            gradientUnits="userSpaceOnUse"
            x1="5"
            y1="5"
            x2="66"
            y2="55"
          >
            <stop offset="0" stopColor="#8B5CF6" />
            <stop offset="0.55" stopColor="#C76BC4" />
            <stop offset="1" stopColor="#FCC63A" />
          </linearGradient>
        </defs>
        <g
          transform="skewX(-12) translate(10 0)"
          stroke={`url(#${ink})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5,5 20,55 35,5" />
          <path d="M61 13C57 6 49 4.5 44 6C36 8.5 36 19 43 24C48 27.5 56 30 60 35C66 43 60 55 49 55C43 55 38 52.5 35 47" />
        </g>
      </svg>
      <span aria-hidden className={textClassName}>
        Claude
      </span>
    </span>
  )
}
