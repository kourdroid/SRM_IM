import { PlugZap, TriangleAlert } from "lucide-react"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { SegmentedControl } from "@/components/shared/SegmentedControl"
import { Button } from "@/components/ui/button"
import { useIncidents, type Incident, type IncidentFilters } from "@/data/incidents"
import { buildPosteIndex, useNetwork } from "@/data/network"

import { DepartsTable } from "./components/DepartsTable"
import { NetworkKpis } from "./components/NetworkKpis"
import { NetworkSkeleton } from "./components/NetworkSkeleton"
import {
  buildDepartRows,
  buildPosteGroups,
  DAY_MS,
  DEFAULT_SORT,
  NETWORK_PERIOD_DAYS,
  NETWORK_PERIOD_OPTIONS,
  NETWORK_WINDOW_DAYS,
  nextSort,
  summarizeNetwork,
  type NetworkPeriodKey,
  type SortKey,
  type SortState,
} from "./network-stats"

const EMPTY_INCIDENTS: Incident[] = []

/** Postes sources and their départs, with MT incidents per départ and a shortcut to the map. */
export function NetworkPage() {
  const navigate = useNavigate()
  // Fixed at mount, like the overview: the period windows do not drift while the page is open.
  const [now] = useState(() => Date.now())
  const [period, setPeriod] = useState<NetworkPeriodKey>("30d")
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  const networkQuery = useNetwork(true)
  const incidentFilters = useMemo<IncidentFilters>(
    () => ({ network: "MT", from: new Date(now - NETWORK_WINDOW_DAYS * DAY_MS).toISOString() }),
    [now],
  )
  const incidentsQuery = useIncidents(incidentFilters)

  const network = networkQuery.data
  const incidents = incidentsQuery.data ?? EMPTY_INCIDENTS
  const posteIndex = useMemo(() => buildPosteIndex(network), [network])
  const summary = useMemo(() => (network ? summarizeNetwork(network) : null), [network])

  const periodStart = now - NETWORK_PERIOD_DAYS[period] * DAY_MS
  const rows = useMemo(
    () => (network ? buildDepartRows(network.departs, incidents, periodStart) : []),
    [network, incidents, periodStart],
  )
  const groups = useMemo(
    () => (network ? buildPosteGroups(rows, network.postes, posteIndex, sort) : []),
    [network, rows, posteIndex, sort],
  )

  const handleSort = useCallback((key: SortKey) => setSort((current) => nextSort(current, key)), [])
  const viewOnMap = useCallback(() => navigate("/carte"), [navigate])

  const isPending = networkQuery.isPending || incidentsQuery.isPending
  const isError = networkQuery.isError || incidentsQuery.isError
  const isEmptyNetwork = network !== undefined && network.postes.length === 0 && network.departs.length === 0
  const periodDays = NETWORK_PERIOD_DAYS[period]

  function retry() {
    void networkQuery.refetch()
    void incidentsQuery.refetch()
  }

  let body: ReactNode
  if (isPending) {
    body = <NetworkSkeleton />
  } else if (isError) {
    const message = networkQuery.error ?? incidentsQuery.error
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Chargement impossible"
        description={message instanceof Error ? message.message : undefined}
        action={<Button onClick={retry}>Réessayer</Button>}
      />
    )
  } else if (isEmptyNetwork || !summary) {
    body = (
      <EmptyState
        icon={PlugZap}
        title="Aucun poste ni départ"
        description="Le réseau HTA n'a pas encore été importé."
      />
    )
  } else {
    body = (
      <>
        <NetworkKpis summary={summary} />
        <SectionCard
          title="Départs par poste source"
          description={`Incidents MT sur les ${periodDays} derniers jours. Le dernier incident est recherché sur ${NETWORK_WINDOW_DAYS} jours.`}
          contentClassName="px-0"
        >
          <DepartsTable groups={groups} sort={sort} onSort={handleSort} onViewOnMap={viewOnMap} />
        </SectionCard>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Postes et départs"
        description="Réseau HTA par poste source : longueur des lignes et incidents MT par départ."
        actions={
          <SegmentedControl
            ariaLabel="Période des incidents"
            value={period}
            onValueChange={setPeriod}
            options={NETWORK_PERIOD_OPTIONS}
          />
        }
      />

      {body}
    </div>
  )
}
