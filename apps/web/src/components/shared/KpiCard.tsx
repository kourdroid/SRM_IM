import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * KPI tile: label, tabular value, footnote and an optional chart slot.
 * Pass `revealDelay` (ms) on first paint to fade the tile in; `interactive` adds the hover shadow for clickable tiles.
 */
export function KpiCard({
  label,
  value,
  footnote,
  chart,
  variant = "default",
  revealDelay,
  interactive = false,
}: {
  label: string
  value: ReactNode
  footnote?: ReactNode
  chart?: ReactNode
  variant?: "default" | "inverted"
  revealDelay?: number
  interactive?: boolean
}) {
  const inverted = variant === "inverted"
  const revealed = revealDelay !== undefined

  return (
    <Card
      className={cn(
        "gap-3",
        revealed ? "animate-reveal" : undefined,
        interactive ? "transition-shadow duration-(--duration-base) hover:shadow-soft-lg" : undefined,
        inverted ? "bg-navy text-white dark:bg-card dark:text-card-foreground" : undefined
      )}
      style={revealed ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      <div className="flex flex-col gap-1 px-(--card-spacing)">
        <p className={cn("text-sm font-medium", inverted ? "text-white/70 dark:text-muted-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            inverted ? "text-lime dark:text-foreground" : undefined
          )}
        >
          {value}
        </p>
        {footnote ? (
          <div className={cn("text-xs tabular-nums", inverted ? "text-white/70 dark:text-muted-foreground" : "text-muted-foreground")}>
            {footnote}
          </div>
        ) : null}
      </div>
      {chart ? <div className="px-(--card-spacing)">{chart}</div> : null}
    </Card>
  )
}
