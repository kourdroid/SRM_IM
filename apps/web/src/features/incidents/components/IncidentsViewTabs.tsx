import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { INCIDENT_VIEWS, parseIncidentView, type IncidentViewKey } from "../table-utils"

/** Saved views as tabs; each tab shows how many incidents it holds for the current filters. */
export function IncidentsViewTabs({
  value,
  counts,
  onValueChange,
}: {
  value: IncidentViewKey
  counts: Record<IncidentViewKey, number>
  onValueChange: (view: IncidentViewKey) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(parseIncidentView(next))}>
      <TabsList aria-label="Vues enregistrées" className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
        {INCIDENT_VIEWS.map((view) => {
          const isActive = view.key === value
          return (
            <TabsTrigger
              key={view.key}
              value={view.key}
              className="h-8 gap-2 rounded-md px-3 text-sm data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              {view.label}
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 text-xs font-medium tabular-nums",
                  isActive ? "bg-muted text-foreground" : "bg-card/60 text-muted-foreground",
                )}
              >
                {counts[view.key]}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
