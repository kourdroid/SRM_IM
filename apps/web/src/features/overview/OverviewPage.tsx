import { ChartNoAxesColumn, TriangleAlert } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useLocation } from "react-router"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { Reveal } from "@/components/shared/Reveal"
import { SegmentedControl } from "@/components/shared/SegmentedControl"
import { Button } from "@/components/ui/button"
import { PERIOD_OPTIONS, useDashboardFilters, type PeriodKey } from "@/data/filters"
import { useIncidents, type Incident } from "@/data/incidents"
import { formatDateLong } from "@/lib/format"
import { DailyIncidentsCard } from "@/features/overview/components/DailyIncidentsCard"
import { ExportCsvButton } from "@/features/overview/components/ExportCsvButton"
import { MapTeaserCard } from "@/features/overview/components/MapTeaserCard"
import { OverviewKpis } from "@/features/overview/components/OverviewKpis"
import { OverviewSkeleton } from "@/features/overview/components/OverviewSkeleton"
import { RecentIncidentsCard } from "@/features/overview/components/RecentIncidentsCard"
import { TopTypesCard } from "@/features/overview/components/TopTypesCard"
import {
  buildDailyBuckets,
  chartDaysFor,
  countMappedIncidents,
  dayKey,
  findPeaks,
  recentIncidents,
  summarizeIncidents,
  topIncidentTypes,
} from "@/features/overview/stats"

const EMPTY_INCIDENTS: Incident[] = []

/** The overview offers the three rolling windows; "today" and "all" can still arrive from the URL. */
const SEGMENT_PERIODS: PeriodKey[] = ["7d", "14d", "30d"]
const SEGMENT_OPTIONS = PERIOD_OPTIONS.filter((option) => SEGMENT_PERIODS.includes(option.value))

/** Number of incidents shown in the "Derniers incidents" table and the sparkline length. */
const RECENT_LIMIT = 6
const SPARKLINE_DAYS = 14

/** Supervision overview: KPIs, daily chart, top types, latest incidents and a map teaser for the filtered period. */
export function OverviewPage() {
  const { state, setFilter, queryFilters } = useDashboardFilters()
  const { search } = useLocation()
  const [now] = useState(() => new Date())
  const incidentsQuery = useIncidents(queryFilters)
  const incidents = incidentsQuery.data ?? EMPTY_INCIDENTS

  const days = chartDaysFor(state.period)
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === state.period)?.label ?? ""
  const exportName = `incidents-${state.period}-${dayKey(now)}.csv`

  const summary = useMemo(() => summarizeIncidents(incidents), [incidents])
  const buckets = useMemo(() => buildDailyBuckets(incidents, days, now), [incidents, days, now])
  const peaks = useMemo(() => findPeaks(buckets), [buckets])
  const sparkline = useMemo(() => buckets.slice(-SPARKLINE_DAYS), [buckets])
  const types = useMemo(() => topIncidentTypes(incidents), [incidents])
  const recent = useMemo(() => recentIncidents(incidents, RECENT_LIMIT), [incidents])
  const mapped = useMemo(() => countMappedIncidents(incidents), [incidents])

  let body: ReactNode
  if (incidentsQuery.isPending) {
    body = <OverviewSkeleton />
  } else if (incidentsQuery.isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Chargement impossible"
        description={incidentsQuery.error instanceof Error ? incidentsQuery.error.message : undefined}
        action={<Button onClick={() => void incidentsQuery.refetch()}>Réessayer</Button>}
      />
    )
  } else if (incidents.length === 0) {
    body = (
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Aucun incident sur cette période"
        description="Élargissez la période pour voir des incidents."
      />
    )
  } else {
    body = (
      <>
        <OverviewKpis summary={summary} periodLabel={periodLabel} sparkline={sparkline} />

        <Reveal delay={160}>
          <div className="grid gap-4 lg:grid-cols-3">
            <DailyIncidentsCard buckets={buckets} peaks={peaks} className="lg:col-span-2" />
            <TopTypesCard types={types} search={search} />
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="grid gap-4 lg:grid-cols-3">
            <RecentIncidentsCard incidents={recent} search={search} className="lg:col-span-2" />
            <MapTeaserCard mapped={mapped} total={summary.total} search={search} />
          </div>
        </Reveal>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vue d'ensemble"
        description={`${formatDateLong(now)} · données à jour`}
        actions={
          <>
            <SegmentedControl
              ariaLabel="Période"
              value={state.period}
              onValueChange={(period: PeriodKey) => setFilter("period", period)}
              options={SEGMENT_OPTIONS}
            />
            <ExportCsvButton
              incidents={incidents}
              filename={exportName}
              disabled={incidentsQuery.isPending || incidentsQuery.isError}
            />
          </>
        }
      />

      {body}
    </div>
  )
}
