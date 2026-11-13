import { ArrowRight } from "lucide-react"
import { Link } from "react-router"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { IncidentTypeStat } from "@/features/overview/stats"

const TONE_CLASS: Record<IncidentTypeStat["tone"], string> = {
  bt: "bg-bt",
  mt: "bg-mt",
  muted: "bg-muted-foreground/40",
}

/** Most frequent incident types as soft horizontal bars, with a link to the full incident list. */
export function TopTypesCard({ types, search }: { types: IncidentTypeStat[]; search: string }) {
  const max = Math.max(1, ...types.map((type) => type.total))

  return (
    <SectionCard
      title="Types les plus fréquents"
      description="Top 6 sur la période"
      contentClassName="gap-5"
    >
      {types.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {types.map((type) => (
            <li key={type.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium" title={type.label}>
                  {type.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(type.total)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", TONE_CLASS[type.tone])}
                  style={{ width: `${(type.total / max) * 100}%` }}
                />
              </div>
              <span className="sr-only">
                BT {formatNumber(type.bt)}, MT {formatNumber(type.mt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun type à afficher.</p>
      )}

      <Button variant="ghost" className="w-full justify-between" asChild>
        <Link to={`/incidents${search}`}>
          Voir tous les incidents
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </SectionCard>
  )
}
