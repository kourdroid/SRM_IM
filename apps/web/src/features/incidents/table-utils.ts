import type { SortingState } from "@tanstack/react-table"

import { isLateEntry, type Incident } from "@/data/incidents"
import { APP_LOCALE, APP_TIME_ZONE, formatDateTime } from "@/lib/format"

/** Rows per page in the incidents table. */
export const PAGE_SIZE = 25

/** Default table order: incident date, newest first. */
export const DEFAULT_SORTING: SortingState = [{ id: "date", desc: true }]

const EMPTY_VALUE = "—"

/** Saved views shown as tabs; the key is stored in the `vue` URL parameter. */
export const INCIDENT_VIEWS = [
  { key: "tous", label: "Tous" },
  { key: "en-cours", label: "En cours" },
  { key: "reclamations", label: "Réclamations" },
  { key: "tardives", label: "Saisis après coup" },
] as const

export type IncidentViewKey = (typeof INCIDENT_VIEWS)[number]["key"]

const INCIDENT_VIEW_KEYS: IncidentViewKey[] = INCIDENT_VIEWS.map((view) => view.key)

/** Narrows an arbitrary URL value to a known saved view, defaulting to "Tous". */
export function parseIncidentView(value: string | null): IncidentViewKey {
  return INCIDENT_VIEW_KEYS.find((key) => key === value) ?? "tous"
}

/** Whether an incident belongs to a saved view. */
export function matchesIncidentView(incident: Incident, view: IncidentViewKey): boolean {
  switch (view) {
    case "en-cours":
      return incident.status === "open"
    case "reclamations":
      return incident.reclamation
    case "tardives":
      return isLateEntry(incident)
    case "tous":
      return true
  }
}

/** Counts incidents per saved view for an already filtered list. */
export function countIncidentViews(rows: readonly Incident[]): Record<IncidentViewKey, number> {
  const counts: Record<IncidentViewKey, number> = { tous: 0, "en-cours": 0, reclamations: 0, tardives: 0 }
  for (const row of rows) {
    for (const key of INCIDENT_VIEW_KEYS) {
      if (matchesIncidentView(row, key)) counts[key] += 1
    }
  }
  return counts
}

/**
 * Normalizes text for search: lowercase, accents removed (NFD then combining marks dropped),
 * whitespace collapsed. "Départ" and "depart" compare equal.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Keeps incidents whose village, commune, type, départ HTA or agent contains every word of the query.
 * An empty query returns a copy of the input.
 */
export function filterIncidentsBySearch(rows: readonly Incident[], query: string): Incident[] {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean)
  if (tokens.length === 0) return [...rows]

  return rows.filter((incident) => {
    const haystack = normalizeSearchText(
      [incident.village, incident.commune, incident.incidentType, incident.departHta ?? "", incident.agentName ?? ""].join(" "),
    )
    return tokens.every((token) => haystack.includes(token))
  })
}

/** Column ids that can be sorted in the table. */
export type SortableColumnId = "date" | "type" | "commune" | "agent" | "status"

/** Ascending comparators, one per sortable column; descending order is applied by the caller. */
export const INCIDENT_SORTERS: Record<SortableColumnId, (a: Incident, b: Incident) => number> = {
  date: (a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0),
  type: (a, b) => compareText(a.incidentType, b.incidentType),
  commune: (a, b) => compareText(a.commune, b.commune),
  agent: (a, b) => compareText(a.agentName ?? "", b.agentName ?? ""),
  status: (a, b) => statusRank(a.status) - statusRank(b.status),
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "fr", { sensitivity: "base", numeric: true })
}

function statusRank(status: Incident["status"]): number {
  return status === "open" ? 0 : 1
}

export function isSortableColumnId(id: string): id is SortableColumnId {
  return Object.hasOwn(INCIDENT_SORTERS, id)
}

/**
 * Returns the rows in the order the table shows them for the active sort (first entry only,
 * the table is single-sort). Used by the CSV export so the file matches the screen.
 */
export function sortIncidents(rows: readonly Incident[], sorting: SortingState): Incident[] {
  const active = sorting[0]
  if (!active || !isSortableColumnId(active.id)) return [...rows]

  const sorter = INCIDENT_SORTERS[active.id]
  const direction = active.desc ? -1 : 1
  return [...rows].sort((a, b) => direction * sorter(a, b))
}

/** True when the incident has both coordinates. */
export function hasPosition(incident: Pick<Incident, "latitude" | "longitude">): boolean {
  return typeof incident.latitude === "number" && typeof incident.longitude === "number"
}

/** Duration between two ISO instants as "x h y min"; "—" when either bound is invalid or the order is reversed. */
export function formatDuration(fromIso: string, toIso: string): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso)
  if (!Number.isFinite(ms) || ms < 0) return EMPTY_VALUE
  const totalMinutes = Math.floor(ms / 60_000)
  return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`
}

const coordinateFormatter = new Intl.NumberFormat(APP_LOCALE, { useGrouping: false, maximumFractionDigits: 6 })

/** Formats a coordinate with a French decimal comma, e.g. -8,123456. */
export function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? coordinateFormatter.format(value) : EMPTY_VALUE
}

/** Google Maps search centred on a position (opens the place). */
export function googleMapsPlaceUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

/** Google Maps directions to a position. */
export function googleMapsRouteUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

/**
 * Builds the map link for an incident. Keeps the current filter query so the map shows the same
 * selection, drops the page-only `vue` and `incident` parameters, and adds `incident` when given.
 */
export function buildMapHref(search: string, incidentId?: string): string {
  const params = new URLSearchParams(search)
  params.delete("vue")
  params.delete("incident")
  if (incidentId) params.set("incident", incidentId)
  const query = params.toString()
  return query ? `/carte?${query}` : "/carte"
}

const CSV_HEADERS = [
  "Date",
  "Saisi le",
  "Réseau",
  "Type",
  "Départ HTA",
  "Commune",
  "Village",
  "Statut",
  "Réclamation",
  "Agent",
  "Latitude",
  "Longitude",
]

/** Text cell: quoted when it holds a separator, and guarded against spreadsheet formula injection. */
function csvTextCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return csvQuote(guarded)
}

/** Plain cell (numbers, dates): only quoted when needed. */
function csvPlainCell(value: string): string {
  return csvQuote(value)
}

function csvQuote(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toCsvRow(incident: Incident): string[] {
  return [
    csvPlainCell(formatDateTime(incident.date)),
    csvPlainCell(formatDateTime(incident.createdAt)),
    csvPlainCell(incident.network),
    csvTextCell(incident.incidentType),
    csvTextCell(incident.departHta ?? ""),
    csvTextCell(incident.commune),
    csvTextCell(incident.village),
    csvPlainCell(incident.status === "open" ? "En cours" : "Clôturé"),
    csvPlainCell(incident.reclamation ? "Oui" : "Non"),
    csvTextCell(incident.agentName ?? ""),
    csvPlainCell(incident.latitude === null ? "" : formatCoordinate(incident.latitude)),
    csvPlainCell(incident.longitude === null ? "" : formatCoordinate(incident.longitude)),
  ]
}

/**
 * Builds the incidents CSV: UTF-8 with a byte order mark (so Excel reads accents), semicolon
 * separator (French Excel default), CRLF line endings and French decimal commas for coordinates.
 */
const UTF8_BOM = String.fromCharCode(0xfeff)

export function buildIncidentsCsv(rows: readonly Incident[]): string {
  const lines = [CSV_HEADERS.map(csvPlainCell), ...rows.map(toCsvRow)].map((cells) => cells.join(";"))
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`
}

/** Export file name for a given instant, dated in the app time zone: incidents-YYYY-MM-DD.csv. */
export function incidentsExportFileName(now: Date): string {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  return `incidents-${isoDate}.csv`
}
