import { RotateCcw } from "lucide-react"
import type { ReactNode } from "react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportExportRecord, ReportExportStatus } from "@/data/reports"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<ReportExportStatus, string> = {
  pending: "En attente",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
}

const STATUS_CLASSES: Record<ReportExportStatus, string> = {
  pending: "bg-warning-soft text-warning",
  running: "bg-warning-soft text-warning",
  done: "bg-success-soft text-success",
  failed: "bg-destructive/10 text-destructive",
}

/** The ten most recent exports of the current user. A past export can restore its filters and be generated again. */
export function ExportHistoryCard({
  exports,
  isPending,
  isError,
  onReapply,
}: {
  exports: ReportExportRecord[] | undefined
  isPending: boolean
  isError: boolean
  onReapply: (record: ReportExportRecord) => void
}) {
  let body: ReactNode
  if (isPending) {
    body = (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    )
  } else if (isError) {
    body = <p className="text-sm text-muted-foreground">Les exports récents ne sont pas disponibles pour le moment.</p>
  } else if (!exports || exports.length === 0) {
    body = <p className="text-sm text-muted-foreground">Aucun export pour le moment.</p>
  } else {
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {exports.map((record) => (
          <li key={record.id} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium tabular-nums">{formatDateTime(record.createdAt)}</span>
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
                  STATUS_CLASSES[record.status],
                )}
              >
                {STATUS_LABELS[record.status]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Du {formatDate(record.startDate)} au {formatDate(record.endDate)}
              {record.status === "done" ? ` · ${formatNumber(record.rowCount)} lignes` : null}
            </p>
            {record.status === "failed" && record.errorMessage ? (
              <p className="text-xs text-destructive">{record.errorMessage}</p>
            ) : null}
            <div>
              <Button variant="ghost" size="sm" onClick={() => onReapply(record)}>
                <RotateCcw aria-hidden="true" />
                Réappliquer les filtres
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <SectionCard
      title="Exports récents"
      description="Les fichiers se téléchargent au moment de leur génération. Pour en refaire un, réappliquez ses filtres."
      contentClassName="gap-4"
    >
      {body}
    </SectionCard>
  )
}
