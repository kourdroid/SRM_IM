import type { ReactNode } from "react"

import { KpiCard } from "@/components/shared/KpiCard"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportSummary } from "@/data/reports"
import { APP_LOCALE, formatNumber, formatPercent } from "@/lib/format"

const decimalFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 })

function formatDays(value: number): string {
  return `${decimalFormatter.format(value)} j`
}

/** Headline indicators for the filtered period. Shows skeleton cards while the summary loads. */
export function ReportKpis({ summary }: { summary: ReportSummary | undefined }) {
  if (!summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  const reclamationRatio = summary.total > 0 ? summary.reclamations / summary.total : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        value={formatDays(summary.avgClosureDays)}
        footnote={<FootnoteLine>Le plus long : {formatDays(summary.maxClosureDays)}</FootnoteLine>}
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
