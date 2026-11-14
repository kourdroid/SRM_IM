import { CalendarRange, TriangleAlert } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCommunes } from "@/data/incidents"
import type { ReportExportRecord } from "@/data/reports"
import {
  buildRpcParams,
  useReportAgents,
  useReportBreakdowns,
  useReportExports,
  useReportRows,
  useReportSummary,
} from "@/data/reports"
import { BreakdownCard } from "@/features/reports/components/BreakdownCard"
import { ExportCard } from "@/features/reports/components/ExportCard"
import { MonthlyCard } from "@/features/reports/components/MonthlyCard"
import { ReportFilterCard } from "@/features/reports/components/ReportFilterCard"
import { ReportKpis } from "@/features/reports/components/ReportKpis"
import { ReportRowsTable } from "@/features/reports/components/ReportRowsTable"
import {
  createInitialForm,
  formFromExport,
  getRangeError,
  toReportFilters,
  todayInAppZone,
  type ReportFormState,
} from "@/features/reports/report-form"
import { formatNumber } from "@/lib/format"

const BREAKDOWN_SKELETONS = 6

/**
 * Supervision reports for admins and directors: filters, KPIs, breakdowns, a paginated preview of the rows and
 * the Excel export. Every query follows the same filters, which are kept in local state.
 */
export function ReportsPage() {
  const [today] = useState(() => todayInAppZone())
  const [form, setForm] = useState<ReportFormState>(() => createInitialForm(today))
  const [page, setPage] = useState(0)

  const rangeError = getRangeError(form)
  const filters = useMemo(() => toReportFilters(form), [form])
  const params = useMemo(() => buildRpcParams(filters), [filters])

  const summary = useReportSummary(params)
  const breakdowns = useReportBreakdowns(params)
  const rows = useReportRows(params, page)
  const agents = useReportAgents()
  const communes = useCommunes()
  const exportsQuery = useReportExports()

  const total = summary.data?.total ?? 0

  function updateForm(patch: Partial<ReportFormState>) {
    setForm((previous) => ({ ...previous, ...patch }))
    setPage(0)
  }

  function resetForm() {
    setForm(createInitialForm(today))
    setPage(0)
  }

  function reapplyExport(record: ReportExportRecord) {
    setForm(formFromExport(record))
    setPage(0)
  }

  let body: ReactNode
  if (params === null) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="Période à corriger"
        description={rangeError ?? "Choisissez une période valide pour afficher le rapport."}
      />
    )
  } else if (summary.isError || breakdowns.isError) {
    const error = summary.error ?? breakdowns.error
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Rapport indisponible"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Button
            onClick={() => {
              void summary.refetch()
              void breakdowns.refetch()
            }}
          >
            Réessayer
          </Button>
        }
      />
    )
  } else {
    body = (
      <>
        <ReportKpis summary={summary.data} />

        {summary.data && total === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Aucun incident sur cette période"
            description="Élargissez la période ou retirez des filtres pour voir des données."
          />
        ) : breakdowns.data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <MonthlyCard points={breakdowns.data.monthly} className="lg:col-span-2" />
            <BreakdownCard title="Types d'incidents" points={breakdowns.data.byIncidentType} />
            <BreakdownCard title="Communes" points={breakdowns.data.byCommune} />
            <BreakdownCard title="Agents" points={breakdowns.data.byAgent} />
            <BreakdownCard title="Départs HTA" description="Incidents MT par départ" points={breakdowns.data.byDepartHta} />
            <BreakdownCard
              title="Matériels utilisés"
              description="Quantités consommées"
              points={breakdowns.data.byMaterialQuantity}
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
            {Array.from({ length: BREAKDOWN_SKELETONS }, (_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        )}

        <ReportRowsTable
          rows={rows.data}
          total={total}
          page={page}
          isPending={rows.isPending}
          isFetching={rows.isFetching}
          isError={rows.isError}
          errorMessage={rows.error instanceof Error ? rows.error.message : undefined}
          onPageChange={setPage}
          onRetry={() => void rows.refetch()}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rapports et exports"
        description={
          summary.data
            ? `${formatNumber(total)} incident${total > 1 ? "s" : ""} sur la période sélectionnée`
            : "Indicateurs, répartitions et export Excel pour la période choisie."
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ReportFilterCard
          form={form}
          today={today}
          communes={communes.data ?? []}
          agents={agents.data ?? []}
          rangeError={rangeError}
          onChange={updateForm}
          onReset={resetForm}
          className="xl:col-span-2"
        />
        <ExportCard
          filters={params ? filters : null}
          exports={exportsQuery.data}
          exportsPending={exportsQuery.isPending}
          exportsError={exportsQuery.isError}
          onReapply={reapplyExport}
          className="xl:col-span-1"
        />
      </div>

      {body}
    </div>
  )
}
