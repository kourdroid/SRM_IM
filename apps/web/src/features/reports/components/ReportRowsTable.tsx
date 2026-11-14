import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { REPORT_PAGE_SIZE, type ReportRow } from "@/data/reports"
import { formatDateTime, formatNumber } from "@/lib/format"

const SKELETON_ROWS = 5

/** Header cells stay visible while the preview scrolls vertically. */
const STICKY_HEAD = "sticky top-0 z-10 bg-card"

/**
 * Paginated preview of the incident rows behind the report (the export contains every row).
 * A plain table sits in a scroll container so the header can stick; the base Table wrapper would block that.
 */
export function ReportRowsTable({
  rows,
  total,
  page,
  isPending,
  isFetching,
  isError,
  errorMessage,
  onPageChange,
  onRetry,
}: {
  rows: ReportRow[] | undefined
  /** Total rows for the filters (from the summary). */
  total: number
  page: number
  isPending: boolean
  isFetching: boolean
  isError: boolean
  errorMessage?: string
  onPageChange: (page: number) => void
  onRetry: () => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE))
  const firstRow = total === 0 ? 0 : page * REPORT_PAGE_SIZE + 1
  const lastRow = Math.min(total, (page + 1) * REPORT_PAGE_SIZE)

  let body: ReactNode
  if (isPending) {
    body = (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  } else if (isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Aperçu indisponible"
        description={errorMessage}
        action={<Button onClick={onRetry}>Réessayer</Button>}
      />
    )
  } else if (!rows || rows.length === 0) {
    body = <EmptyState title="Aucun incident sur cette période" description="Élargissez la période ou retirez des filtres." />
  } else {
    body = (
      <div aria-busy={isFetching} className="max-h-[28rem] overflow-auto rounded-lg">
        <table className="w-full min-w-[46rem] caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={STICKY_HEAD}>
                Date
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Réseau
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Type
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Commune
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Village
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Agent
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Statut
              </TableHead>
              <TableHead scope="col" className={STICKY_HEAD}>
                Réclamation
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>
                  <NetworkBadge network={row.type} />
                </TableCell>
                <TableCell className="max-w-48 truncate" title={row.incidentType}>
                  {row.incidentType || "Non classé"}
                </TableCell>
                <TableCell>{row.communeName ?? "Commune inconnue"}</TableCell>
                <TableCell>{row.village ?? "—"}</TableCell>
                <TableCell>{row.agentName ?? "—"}</TableCell>
                <TableCell>
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell>{row.reclamation ? "Oui" : "Non"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    )
  }

  return (
    <SectionCard
      title="Aperçu des incidents"
      description={
        isPending
          ? "Chargement…"
          : total === 0
            ? "Aucun incident sur la période"
            : `Lignes ${formatNumber(firstRow)} à ${formatNumber(lastRow)} sur ${formatNumber(total)}`
      }
      contentClassName="gap-4"
    >
      {body}

      {!isPending && !isError && total > 0 ? (
        <nav aria-label="Pagination de l'aperçu" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm tabular-nums text-muted-foreground">
            Page {formatNumber(page + 1)} sur {formatNumber(pageCount)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              Précédent
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page + 1 >= pageCount || isFetching}
              onClick={() => onPageChange(page + 1)}
            >
              Suivant
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}
    </SectionCard>
  )
}
