import type { ReactNode } from "react"

import { KpiCard } from "@/components/shared/KpiCard"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportSummary } from "@/data/reports"
import { APP_LOCALE, formatNumber, formatPercent } from "@/lib/format"

const decimalFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 })

/** Closure durations under two days read better in hours ("2,4 h") than as a fraction of a day ("0,1 j"). */
function formatClosureDuration(days: number): string {
  const hours = days * 24
  if (hours < 48) return `${decimalFormatter.format(hours)} h`
  return `${decimalFormatter.format(days)} j`
}

/**
 * Five KPI cards in one row on wide screens, two per row on small tablets. On those, the first card spans the full
 * width so the grid has no gap. Every card stretches to the row height.
 */
const FIRST_CARD_SPAN = "sm:col-span-2 xl:col-span-1 [&>[data-slot=card]]:h-full"

/** Headline indicators for the filtered period. Shows skeleton cards while the summary loads. */
export function ReportKpis({ summary }: { summary: ReportSummary | undefined }) {
  if (!summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className={`h-32 rounded-lg ${index === 0 ? FIRST_CARD_SPAN : ""}`} />
        ))}
      </div>
    )
  }

  const reclamationRatio = summary.total > 0 ? summary.reclamations / summary.total : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <div className={FIRST_CARD_SPAN}>
        <KpiCard
          label="Incidents"
          value={formatNumber(summary.total)}
          footnote={
            <FootnoteLine>
              <span className="font-medium text-bt">BT {formatNumber(summary.bt)}</span>
              <Separator />
              <span className="font-medium text-mt">MT {formatNumber(summary.mt)}</span>
            </FootnoteLine>
          }
        />
      </div>

      <KpiCard
        label="En cours"
        value={formatNumber(summary.open)}
        footnote={<FootnoteLine>Clôturés : {formatNumber(summary.closed)}</FootnoteLine>}
      />

      <KpiCard
        label="Réclamations"
        value={formatNumber(summary.reclamations)}
        footnote={<FootnoteLine>{formatPercent(reclamationRatio)} du total</FootnoteLine>}
      />

      <KpiCard
        label="Délai moyen de clôture"
        value={formatClosureDuration(summary.avgClosureDays)}
        footnote={<FootnoteLine>Le plus long : {formatClosureDuration(summary.maxClosureDays)}</FootnoteLine>}
      />

      <KpiCard
        label="Sans GPS"
        value={formatNumber(summary.missingGps)}
        footnote={<FootnoteLine>Sans photo : {formatNumber(summary.missingPhoto)}</FootnoteLine>}
      />
    </div>
  )
}

function FootnoteLine({ children }: { children: ReactNode }) {
  return <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">{children}</span>
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      ·
    </span>
  )
}
