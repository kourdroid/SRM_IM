import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, RotateCcw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  reportExportFileName,
  requestReportExport,
  type ReportExportRecord,
  type ReportExportStatus,
  type ReportFilters,
} from "@/data/reports"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { downloadFile } from "@/features/reports/download"

type ExportPhase = "generating" | "downloading"

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

/**
 * Excel export of the filtered incidents. The server builds the workbook and returns a signed link, which is then
 * saved in the browser. Recent exports can restore their filters to generate the file again.
 */
export function ExportCard({
  filters,
  exports,
  exportsPending,
  exportsError,
  onReapply,
  className,
}: {
  /** Null while the dates are invalid: the export button is disabled. */
  filters: ReportFilters | null
  exports: ReportExportRecord[] | undefined
  exportsPending: boolean
  exportsError: boolean
  onReapply: (record: ReportExportRecord) => void
  className?: string
}) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<ExportPhase | null>(null)

  const exportMutation = useMutation({
    mutationFn: async (requested: ReportFilters) => {
      setPhase("generating")
      const result = await requestReportExport(requested)
      setPhase("downloading")
      const outcome = await downloadFile(result.downloadUrl, reportExportFileName(requested))
      return { rowCount: result.rowCount, outcome }
    },
    onSuccess: ({ rowCount, outcome }) => {
      if (outcome === "saved") {
        toast.success(`Export prêt : ${formatNumber(rowCount)} incident${rowCount > 1 ? "s" : ""}.`)
      } else {
        toast.success("Le fichier s'ouvre dans un nouvel onglet.")
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setPhase(null)
      void queryClient.invalidateQueries({ queryKey: ["reports", "exports"] })
    },
  })

  const busy = exportMutation.isPending
  const exportError = exportMutation.error

  return (
    <SectionCard
      title="Export Excel"
      description="Fichier complet des incidents de la période, avec les mêmes filtres que le rapport."
      className={className}
      contentClassName="gap-5"
    >
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          disabled={!filters || busy}
          onClick={() => {
            if (filters) exportMutation.mutate(filters)
          }}
        >
          <Download aria-hidden="true" />
          {busy ? "Export en cours…" : "Télécharger en Excel"}
        </Button>

        {busy ? (
          <div role="status" className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {phase === "downloading" ? "Téléchargement du fichier…" : "Génération du fichier sur le serveur… (peut prendre quelques instants)"}
            </p>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        ) : null}

        {exportError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {exportError.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Exports récents</h3>

        {exportsPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : exportsError ? (
          <p className="text-sm text-muted-foreground">Les exports récents ne sont pas disponibles pour le moment.</p>
        ) : !exports || exports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun export pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-2">
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
        )}

        <p className="text-xs text-muted-foreground">
          Le fichier se télécharge au moment de sa génération. Pour un export précédent, réappliquez ses filtres puis
          générez-le à nouveau.
        </p>
      </div>
    </SectionCard>
  )
}
