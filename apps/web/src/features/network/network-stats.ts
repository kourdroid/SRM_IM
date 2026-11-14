import type { Incident } from "@/data/incidents"
import type { NetworkData, NetworkDepart, NetworkPoste } from "@/data/network"
import { APP_LOCALE, formatNumber } from "@/lib/format"

/** Pure helpers for the Postes et départs page: aggregation, grouping and sorting. */

const DAY_MS = 24 * 60 * 60 * 1000

export type NetworkPeriodKey = "7d" | "30d" | "90d"

export const NETWORK_PERIOD_OPTIONS: { value: NetworkPeriodKey; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
]

export const NETWORK_PERIOD_DAYS: Record<NetworkPeriodKey, number> = { "7d": 7, "30d": 30, "90d": 90 }

/** Incidents are fetched once over the longest period; shorter periods are filtered in memory. */
export const NETWORK_WINDOW_DAYS = 90

export { DAY_MS }

export type DepartRow = {
  id: string
  poste: string
  depart: string
  /** False when the départ is not linked to an HTA option of the application. */
  linked: boolean
  aerialKm: number
  undergroundKm: number
  /** MT incidents of the selected period; null when the départ is not linked. */
  incidentCount: number | null
  /** Most recent MT incident date within the fetched window; null when none or not linked. */
  lastIncident: string | null
}

export type SortKey = "depart" | "aerial" | "underground" | "incidents" | "last"
export type SortDirection = "asc" | "desc"
export type SortState = { key: SortKey; direction: SortDirection }

export const DEFAULT_SORT: SortState = { key: "depart", direction: "asc" }

/** Clicking the active column flips its direction; a new column starts ascending for names, descending for numbers and dates. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" }
  }
  return { key, direction: key === "depart" ? "asc" : "desc" }
}

export type NetworkSummary = {
  postes: number
  departs: number
  linked: number
  aerialKm: number
  undergroundKm: number
}

export function summarizeNetwork(data: NetworkData): NetworkSummary {
  let aerialKm = 0
  let undergroundKm = 0
  let linked = 0
  for (const depart of data.departs) {
    aerialKm += depart.aerialKm
    undergroundKm += depart.undergroundKm
    if (depart.appDepart) linked += 1
  }
  return { postes: data.postes.length, departs: data.departs.length, linked, aerialKm, undergroundKm }
}

/** Joins each départ with its MT incidents, matched by name against the HTA option name. */
export function buildDepartRows(departs: NetworkDepart[], incidents: Incident[], periodStartMs: number): DepartRow[] {
  const stats = new Map<string, { count: number; last: string | null; lastMs: number }>()

  for (const incident of incidents) {
    if (!incident.departHta) continue
    const ms = Date.parse(incident.date)
    if (Number.isNaN(ms)) continue

    const entry = stats.get(incident.departHta) ?? { count: 0, last: null, lastMs: 0 }
    if (ms >= periodStartMs) entry.count += 1
    if (entry.last === null || ms > entry.lastMs) {
      entry.last = incident.date
      entry.lastMs = ms
    }
    stats.set(incident.departHta, entry)
  }

  return departs.map((depart): DepartRow => {
    const linked = depart.appDepart !== null
    const entry = depart.appDepart ? stats.get(depart.appDepart) : undefined
    return {
      id: depart.id,
      poste: depart.poste,
      depart: depart.depart,
      linked,
      aerialKm: depart.aerialKm,
      undergroundKm: depart.undergroundKm,
      incidentCount: linked ? (entry?.count ?? 0) : null,
      lastIncident: linked ? (entry?.last ?? null) : null,
    }
  })
}

function compareByKey(a: DepartRow, b: DepartRow, key: SortKey): number {
  switch (key) {
    case "depart":
      return a.depart.localeCompare(b.depart, "fr", { numeric: true })
    case "aerial":
      return a.aerialKm - b.aerialKm
    case "underground":
      return a.undergroundKm - b.undergroundKm
    case "incidents":
      return (a.incidentCount ?? -1) - (b.incidentCount ?? -1)
    case "last":
      return (a.lastIncident ? Date.parse(a.lastIncident) : 0) - (b.lastIncident ? Date.parse(b.lastIncident) : 0)
  }
}

export function sortDepartRows(rows: DepartRow[], sort: SortState): DepartRow[] {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...rows].sort(
    (a, b) => direction * compareByKey(a, b, sort.key) || a.depart.localeCompare(b.depart, "fr", { numeric: true }),
  )
}

export type PosteGroup = {
  poste: string
  colorIndex: number
  rows: DepartRow[]
  aerialKm: number
  undergroundKm: number
  incidentCount: number
}

/** One group per poste source, alphabetical. Postes without départs appear with an empty group. */
export function buildPosteGroups(
  rows: DepartRow[],
  postes: NetworkPoste[],
  posteIndex: ReadonlyMap<string, number>,
  sort: SortState,
): PosteGroup[] {
  const byPoste = new Map<string, DepartRow[]>()
  for (const poste of postes) {
    if (!byPoste.has(poste.name)) byPoste.set(poste.name, [])
  }
  for (const row of rows) {
    const list = byPoste.get(row.poste)
    if (list) list.push(row)
    else byPoste.set(row.poste, [row])
  }

  return [...byPoste]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([poste, list]): PosteGroup => {
      let aerialKm = 0
      let undergroundKm = 0
      let incidentCount = 0
      for (const row of list) {
        aerialKm += row.aerialKm
        undergroundKm += row.undergroundKm
        incidentCount += row.incidentCount ?? 0
      }
      return {
        poste,
        colorIndex: posteIndex.get(poste) ?? 0,
        rows: sortDepartRows(list, sort),
        aerialKm,
        undergroundKm,
        incidentCount,
      }
    })
}

const kmFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 })

/** Kilometres with one decimal at most, French separators, e.g. 1 254,6. */
export function formatKm(value: number): string {
  return Number.isFinite(value) ? kmFormatter.format(value) : "—"
}

/** Count with its French noun, e.g. "1 départ", "3 départs". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
