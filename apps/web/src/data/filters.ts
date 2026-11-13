import { useMemo } from "react"
import { useSearchParams } from "react-router"
import type { IncidentFilters, IncidentStatus, Network } from "@/data/incidents"

/** Period presets shared by every page. */
export type PeriodKey = "today" | "7d" | "14d" | "30d" | "all"

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "14d", label: "14 jours" },
  { value: "30d", label: "30 jours" },
  { value: "all", label: "Tout" },
]

function periodStart(period: PeriodKey): string | undefined {
  if (period === "all") return undefined
  const now = new Date()
  if (period === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

export type DashboardFilterState = {
  period: PeriodKey
  network: Network | "all"
  status: IncidentStatus | "all"
  communeId: string | "all"
  incidentType: string | "all"
}

const DEFAULTS: DashboardFilterState = { period: "30d", network: "all", status: "all", communeId: "all", incidentType: "all" }

/**
 * Filters live in the URL (?periode=…&reseau=…), so a filtered view can be bookmarked or shared,
 * and moving between Vue d'ensemble, Carte and Incidents keeps the same filters.
 */
export function useDashboardFilters() {
  const [params, setParams] = useSearchParams()

  const state: DashboardFilterState = {
    period: (params.get("periode") as PeriodKey) || DEFAULTS.period,
    network: (params.get("reseau") as Network) || DEFAULTS.network,
    status: (params.get("statut") as IncidentStatus) || DEFAULTS.status,
    communeId: params.get("commune") || DEFAULTS.communeId,
    incidentType: params.get("type") || DEFAULTS.incidentType,
  }

  const keyMap: Record<keyof DashboardFilterState, string> = {
    period: "periode",
    network: "reseau",
    status: "statut",
    communeId: "commune",
    incidentType: "type",
  }

  function setFilter<K extends keyof DashboardFilterState>(key: K, value: DashboardFilterState[K]) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === DEFAULTS[key]) next.delete(keyMap[key])
        else next.set(keyMap[key], String(value))
        return next
      },
      { replace: true },
    )
  }

  function reset() {
    setParams(new URLSearchParams(), { replace: true })
  }

  const { period, network, status, communeId, incidentType } = state
  const queryFilters: IncidentFilters = useMemo(
    () => ({
      from: periodStart(period),
      network: network === "all" ? undefined : network,
      status: status === "all" ? undefined : status,
      communeId: communeId === "all" ? undefined : communeId,
      incidentType: incidentType === "all" ? undefined : incidentType,
    }),
    // periodStart depends on "now"; recompute when the period changes, not on every render.
    [period, network, status, communeId, incidentType],
  )

  const isFiltered = Object.keys(keyMap).some((k) => params.has(keyMap[k as keyof DashboardFilterState]))

  return { state, setFilter, reset, queryFilters, isFiltered }
}
