import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Soft container laying out filter controls; wraps on small screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label="Filtres"
      className={cn("flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-2", className)}
    >
      {children}
    </div>
  )
}
