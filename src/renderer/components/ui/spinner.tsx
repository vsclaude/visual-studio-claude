import { cn } from "@/lib/utils"

// The drawing is `.spinner` in `styles/motion.css`, which says why it is a
// comet in the logo's colours and no longer the VS lettermark.
function Spinner({
  className,
  "aria-label": label = "Loading",
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn("spinner size-4 shrink-0", className)}
      {...props}
    />
  )
}

export { Spinner }
