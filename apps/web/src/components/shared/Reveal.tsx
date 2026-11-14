import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Mount-only fade and small rise for first paint. It replays only when the element mounts, so refetches that keep
 * the element mounted do not animate again. Reduced motion removes the animation in index.css.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  /** Start delay in milliseconds, used to stagger sibling blocks. */
  delay?: number
  className?: string
}) {
  return (
    <div className={cn("animate-reveal", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}
