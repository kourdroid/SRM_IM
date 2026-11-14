import { CalendarRange, TriangleAlert } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCommunes } from "@/data/incidents"
import type { ReportExportRecord } from "@/data/reports"
import {
  buildRpcParams,
  DAILY_CHART_MAX_DAYS,
  reportDayCount,
  useReportAgents,
  useReportBreakdowns,
  useReportDaily,
  useReportExports,
  useReportRows,
  useReportSummary,
} from "@/data/reports"
import { BreakdownCard } from "@/features/reports/components/BreakdownCard"
import { DailyTrendCard } from "@/features/reports/components/DailyTrendCard"
import { ExportButton } from "@/features/reports/components/ExportButton"
import { ExportHistoryCard } from "@/features/reports/components/ExportHistoryCard"
import { MonthlyTrendCard } from "@/features/reports/components/MonthlyTrendCard"
import { ReportFilterCard } from "@/features/reports/components/ReportFilterCard"
import { ReportKpis } from "@/features/reports/components/ReportKpis"
import { ReportRowsTable } from "@/features/reports/components/ReportRowsTable"
import {
  createInitialForm,
  formFromExport,
  formatPeriodSummary,
  getRangeError,
  toReportFilters,
  todayInAppZone,
  type ReportFormState,
} from "@/features/reports/report-form"

const BREAKDOWN_SKELETONS = 6

/** Breakdowns fill rows of six columns on wide screens: two wide cards, then three narrower ones. */
const BREAKDOWN_GRID = "grid gap-6 md:grid-cols-2 xl:grid-cols-6"

/**
 * Supervision reports for admins and directors: filters, KPIs, a trend chart, breakdowns, a paginated preview of the
 * rows and the Excel export. Every query follows the same filters, which are kept in local state.
 */
export function ReportsPage() {
  const [today] = useState(() => todayInAppZone())
  const [form, setForm] = useState<ReportFormState>(() => createInitialForm(today))
  const [page, setPage] = useState(0)

  const rangeError = getRangeError(form)
  const filters = useMemo(() => toReportFilters(form), [form])
  const params = useMemo(() => buildRpcParams(filters), [filters])
  const dayCount = reportDayCount(form.startDate, form.endDate)
  const isDaily = dayCount !== null && dayCount <= DAILY_CHART_MAX_DAYS

  const summary = useReportSummary(params)
  const breakdowns = useReportBreakdowns(params)
  const daily = useReportDaily(isDaily ? params : null)
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

  function renderTrend(): ReactNode {
    if (isDaily && dayCount !== null) {
      if (daily.data) {
        return <DailyTrendCard startDate={form.startDate} dayCount={dayCount} points={daily.data} />
      }
      if (daily.isError) {
        return (
          <SectionCard title="Évolution journalière">
            <EmptyState
              icon={TriangleAlert}
              title="Graphique indisponible"
              description={daily.error instanceof Error ? daily.error.message : undefined}
              action={<Button onClick={() => void daily.refetch()}>Réessayer</Button>}
            />
          </SectionCard>
        )
      }
      return <Skeleton className="h-80 rounded-lg" />
    }

    if (breakdowns.data) return <MonthlyTrendCard points={breakdowns.data.monthly} />
    return <Skeleton className="h-80 rounded-lg" />
  }

  function renderBreakdowns(): ReactNode {
    if (!breakdowns.data) {
      return (
        <div className={BREAKDOWN_GRID} aria-busy="true">
          {Array.from({ length: BREAKDOWN_SKELETONS }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-lg" />
          ))}
        </div>
      )
    }

    return (
      <div className={BREAKDOWN_GRID}>
        <BreakdownCard className="xl:col-span-3" title="Types d'incidents" points={breakdowns.data.byIncidentType} />
        <BreakdownCard className="xl:col-span-3" title="Communes" points={breakdowns.data.byCommune} />
        <BreakdownCard className="xl:col-span-2" title="Agents" points={breakdowns.data.byAgent} />
        <BreakdownCard
          className="xl:col-span-2"
          title="Départs HTA"
          description="Incidents MT par départ"
          points={breakdowns.data.byDepartHta}
        />
        <BreakdownCard
          className="md:col-span-2 xl:col-span-2"
          title="Matériels utilisés"
          description="Quantités consommées"
          points={breakdowns.data.byMaterialQuantity}
        />
      </div>
    )
  }

  let content: ReactNode
  if (params === null) {
    content = (
      <EmptyState
        icon={CalendarRange}
        title="Période à corriger"
        description={rangeError ?? "Choisissez une période valide pour afficher le rapport."}
      />
    )
  } else if (summary.isError || breakdowns.isError) {
    const error = summary.error ?? breakdowns.error
    content = (
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
  } else if (summary.data && total === 0) {
    content = (
      <>
        <ReportKpis summary={summary.data} />
        <EmptyState
          icon={CalendarRange}
          title="Aucun incident sur cette période"
          description="Élargissez la période ou retirez des filtres pour voir des données."
        />
      </>
    )
  } else {
    content = (
      <>
        <ReportKpis summary={summary.data} />
        {renderTrend()}
        {renderBreakdowns()}
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
            ? formatPeriodSummary(form.startDate, form.endDate, total)
            : "Indicateurs, répartitions et export Excel pour la période choisie."
        }
        actions={<ExportButton filters={params ? filters : null} />}
      />

      <ReportFilterCard
        form={form}
        today={today}
        communes={communes.data ?? []}
        agents={agents.data ?? []}
        rangeError={rangeError}
        onChange={updateForm}
        onReset={resetForm}
      />

      {content}

      <ExportHistoryCard
        exports={exportsQuery.data}
        isPending={exportsQuery.isPending}
        isError={exportsQuery.isError}
        onReapply={reapplyExport}
      />
    </div>
  )
}
