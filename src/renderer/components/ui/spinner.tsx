import { cn } from "@/lib/utils"

/**
 * The VS lettermark's two strokes, `resources/vs-mark.svg` path for path, for
 * the loaders drawn out of it — this spinner and the chat's `Working…`
 * (`chat-skeleton.tsx`). Two elements rather than one path with a move in it:
 * each carries `pathLength={100}` and its own keyframe, so the dash runs the V
 * and then the S without depending on whether a dash pattern restarts at a
 * subpath, which engines have disagreed on.
 */
export const VS_VIEWBOX = "8.85 -0.05 64.5 60.1"
export const VS_SLANT = "skewX(-12) translate(10 0)"
export const VS_V = "M5 5L20 55L35 5"
export const VS_S =
  "M61 13C57 6 49 4.5 44 6C36 8.5 36 19 43 24C48 27.5 56 30 60 35C66 43 60 55 49 55C43 55 38 52.5 35 47"

// The drawing is `.spinner` in `styles/motion.css`, which says why it is the
// lettermark and not lucide's `Loader2`.
function Spinner({
  className,
  "aria-label": label = "Loading",
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label={label}
      viewBox={VS_VIEWBOX}
      fill="none"
      className={cn("spinner size-4 shrink-0", className)}
      {...props}
    >
      <g
        transform={VS_SLANT}
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="spinner-track" d={VS_V} />
        <path className="spinner-track" d={VS_S} />
        <path className="spinner-run spinner-run-v" d={VS_V} pathLength={100} />
        <path className="spinner-run spinner-run-s" d={VS_S} pathLength={100} />
      </g>
    </svg>
  )
}

export { Spinner }
