import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { reportExportFileName, requestReportExport, type ReportFilters } from "@/data/reports"
import { downloadFile } from "@/features/reports/download"
import { formatNumber } from "@/lib/format"

type ExportPhase = "generating" | "downloading"

/**
 * Primary export action of the reports page. The server builds the workbook and returns a signed link, which is then
 * saved in the browser. Progress and failures appear under the button; the outcome is also announced with a toast.
 */
export function ExportButton({ filters }: { filters: ReportFilters | null }) {
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
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <Button
        size="lg"
        className="w-full sm:w-auto"
        disabled={!filters || busy}
        onClick={() => {
          if (filters) exportMutation.mutate(filters)
        }}
      >
        <Download aria-hidden="true" />
        {busy ? "Export en cours…" : "Télécharger en Excel"}
      </Button>

      {busy ? (
        <div role="status" className="flex flex-col gap-1.5 sm:items-end">
          <p className="text-sm text-muted-foreground">
            {phase === "downloading"
              ? "Téléchargement du fichier…"
              : "Génération sur le serveur, cela peut prendre quelques instants."}
          </p>
          <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      ) : null}

      {exportError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:max-w-sm">
          {exportError.message}
        </p>
      ) : null}
    </div>
  )
}
