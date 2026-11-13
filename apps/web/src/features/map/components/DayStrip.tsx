import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { shortDayLabel, type DayBucket } from "@/features/map/geo"

function dayAriaLabel(bucket: DayBucket): string {
  return `${shortDayLabel(bucket.key)}, ${bucket.count} incident${bucket.count > 1 ? "s" : ""}`
}

/** Floating replay strip: one bar per day of the period; clicking a day filters the map to it. */
export function DayStrip({
  buckets,
  activeKey,
  onSelectDay,
}: {
  buckets: DayBucket[]
  activeKey: string | null
  onSelectDay: (key: string | null) => void
}) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const first = buckets[0]
  const last = buckets[buckets.length - 1]

  return (
    <section
      aria-label="Rejouer une journée"
      className="flex w-full flex-col gap-2 rounded-xl bg-card/90 p-3 shadow-soft-lg backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Rejouer une journée</h2>
        <Button variant="ghost" size="sm" disabled={!activeKey} onClick={() => onSelectDay(null)}>
          Toute la période
        </Button>
      </div>

      <div role="group" aria-label="Incidents par jour" className="flex h-16 items-end gap-[3px]">
        {buckets.map((bucket) => {
          const active = bucket.key === activeKey
          const heightPercent = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 8) : 4
          return (
            <button
              key={bucket.key}
              type="button"
              aria-label={dayAriaLabel(bucket)}
              aria-pressed={active}
              title={bucket.isPeak ? `Pic : ${dayAriaLabel(bucket)}` : dayAriaLabel(bucket)}
              onClick={() => onSelectDay(active ? null : bucket.key)}
              className="flex h-full min-w-1.5 flex-1 items-end rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block w-full rounded-sm transition-colors",
                  active
                    ? "bg-navy dark:bg-foreground"
                    : bucket.isPeak
                      ? "bg-warning"
                      : bucket.count > 0
                        ? "bg-muted-foreground/45 hover:bg-muted-foreground/70"
                        : "bg-muted-foreground/20",
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </button>
          )
        })}
      </div>

      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
        <span>{first ? shortDayLabel(first.key) : ""}</span>
        <span>{last ? shortDayLabel(last.key) : ""}</span>
      </div>
    </section>
  )
}
