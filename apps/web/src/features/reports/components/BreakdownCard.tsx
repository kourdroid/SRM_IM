import { SectionCard } from "@/components/shared/SectionCard"
import type { ReportPoint } from "@/data/reports"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Number of rows shown per breakdown; the server already limits each list to 20. */
const MAX_ROWS = 10

/**
 * Ranked list of one breakdown as soft horizontal bars, each bar scaled to the largest value.
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
  const visible = points.slice(0, MAX_ROWS)
  const max = Math.max(1, ...visible.map((point) => point.value))

  return (
    <SectionCard title={title} description={description} className={className} contentClassName="gap-4">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune donnée pour cette période.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {visible.map((point) => (
            <li key={point.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium" title={point.label}>
                  {point.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(point.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", barClassName)}
                  style={{ width: `${(point.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
