import { VS_S, VS_SLANT, VS_V, VS_VIEWBOX } from "@/components/ui/spinner"

/**
 * The lettermark alone, in `currentColor` — `resources/vs-mark.svg` path for
 * path, sized by its caller. The glyph's ink leans right, so its box's centre
 * is not the eye's; a caller centring it nudges it left a little.
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
