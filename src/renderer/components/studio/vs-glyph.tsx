/**
 * The VS lettermark's two strokes, `resources/vs-mark.svg` path for path, for
 * this glyph and the chat's `Working…` (`chat-skeleton.tsx`), which writes it.
 * Two elements rather than one path with a move in it: each carries its own
 * `pathLength={100}` and keyframe there, so the V is written and then the S
 * without depending on whether a dash pattern restarts at a subpath, which
 * engines have disagreed on.
 */
export const VS_VIEWBOX = "8.85 -0.05 64.5 60.1"
export const VS_SLANT = "skewX(-12) translate(10 0)"
export const VS_V = "M5 5L20 55L35 5"
export const VS_S =
  "M61 13C57 6 49 4.5 44 6C36 8.5 36 19 43 24C48 27.5 56 30 60 35C66 43 60 55 49 55C43 55 38 52.5 35 47"

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
