import { useState } from "react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import type { ReportPoint } from "@/data/reports"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Rows shown before the "Voir tout" toggle. */
const PREVIEW_ROWS = 10

/**
 * Ranked list of one breakdown: label on the left, value on the right, and a thin bar scaled to the largest value.
 * Used for communes, agents, incident types, departs HTA and materials.
 */
export function BreakdownCard({
  title,
  description,
  points,
  formatValue = formatNumber,
  barClassName = "bg-primary",
  className,
}: {
  title: string
  description?: string
  points: ReportPoint[]
  formatValue?: (value: number) => string
  barClassName?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const max = Math.max(1, ...points.map((point) => point.value))
  const visible = expanded ? points : points.slice(0, PREVIEW_ROWS)
  const hasMore = points.length > PREVIEW_ROWS

  return (
    <SectionCard title={title} description={description} className={className} contentClassName="gap-4">
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune donnée pour cette période.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3.5">
            {visible.map((point, index) => (
              <li key={`${index}-${point.label}`} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate" title={point.label}>
                    {point.label}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatValue(point.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-full", barClassName)}
                    style={{ width: `${(point.value / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Réduire" : `Voir tout (${formatNumber(points.length)})`}
            </Button>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}
