import type { PeriodKey } from "@/data/filters"
import type { Incident } from "@/data/incidents"
import { APP_LOCALE, APP_TIME_ZONE, formatDateTime, formatTime } from "@/lib/format"

/** Incident counts for one calendar day (YYYY-MM-DD, Africa/Casablanca), split by network. */
export type DailyBucket = { day: string; total: number; bt: number; mt: number }

/** Headline figures of the overview KPI row. */
export type OverviewSummary = {
  total: number
  bt: number
  mt: number
  /** Distinct agents who recorded at least one incident. */
  agents: number
  open: number
  closed: number
  reclamations: number
  /** Share of incidents flagged as reclamations, from 0 to 1. */
  reclamationRatio: number
  /** Mean hours between incident date and closure, or null when no closed incident has both dates. */
  averageClosureHours: number | null
}

/** One row of the "types les plus fréquents" list. */
export type IncidentTypeStat = {
  label: string
  total: number
  bt: number
  mt: number
  /** Bar colour: BT or MT when one network dominates, muted for "Autre" and ties. */
  tone: "bt" | "mt" | "muted"
}

const HOUR_MS = 60 * 60 * 1000

/** Number of daily bars for each period. "today" and "all" use fixed fallback ranges. */
const CHART_DAYS: Record<PeriodKey, number> = { today: 7, "7d": 7, "14d": 14, "30d": 30, all: 30 }

/** Number of daily bars shown for a period. */
export function chartDaysFor(period: PeriodKey): number {
  return CHART_DAYS[period]
}

const dayKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Returns the calendar day of an instant in Africa/Casablanca as YYYY-MM-DD, or "" for an invalid date. */
export function dayKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = dayKeyFormatter.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

/** Moves a YYYY-MM-DD key by a number of calendar days. Uses UTC arithmetic, so DST never shifts a day. */
export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Builds one bucket per calendar day for the last `days` days ending today (Casablanca time),
 * oldest first. Days without incidents are kept with zero counts so the chart has no gaps.
 */
export function buildDailyBuckets(incidents: Incident[], days: number, now: Date): DailyBucket[] {
  const today = dayKey(now)
  const buckets: DailyBucket[] = Array.from({ length: days }, (_, index) => ({
    day: shiftDayKey(today, index - (days - 1)),
    total: 0,
    bt: 0,
    mt: 0,
  }))
  const indexByDay = new Map(buckets.map((bucket, index) => [bucket.day, index]))

  for (const incident of incidents) {
    const index = indexByDay.get(dayKey(incident.date))
    if (index === undefined) continue
    const bucket = buckets[index]
    bucket.total += 1
    if (incident.network === "BT") bucket.bt += 1
    else bucket.mt += 1
  }
  return buckets
}

/**
 * Days whose count reaches twice the average daily count of the period (zero days included in the average).
 * Returns the highest peaks first, at most `limit` of them.
 */
export function findPeaks(buckets: DailyBucket[], limit = 2): DailyBucket[] {
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0)
  if (total === 0 || buckets.length === 0) return []
  const average = total / buckets.length
  return buckets
    .filter((bucket) => bucket.total > 0 && bucket.total >= 2 * average)
    .sort((a, b) => b.total - a.total || b.day.localeCompare(a.day))
    .slice(0, limit)
}

/**
 * Computes the KPI figures for a list of incidents.
 * Durations use closed incidents only, and negative durations (closure before incident date) are ignored as data errors.
 */
export function summarizeIncidents(incidents: Incident[]): OverviewSummary {
  let bt = 0
  let mt = 0
  let open = 0
  let closed = 0
  let reclamations = 0
  let durationSum = 0
  let durationCount = 0
  const agents = new Set<string>()

  for (const incident of incidents) {
    if (incident.network === "BT") bt += 1
    else mt += 1
    if (incident.status === "open") open += 1
    else closed += 1
    if (incident.reclamation) reclamations += 1
    if (incident.createdBy) agents.add(incident.createdBy)

    if (incident.status === "closed" && incident.closedAt) {
      const hours = (Date.parse(incident.closedAt) - Date.parse(incident.date)) / HOUR_MS
      if (Number.isFinite(hours) && hours >= 0) {
        durationSum += hours
        durationCount += 1
      }
    }
  }

  const total = incidents.length
  return {
    total,
    bt,
    mt,
    agents: agents.size,
    open,
    closed,
    reclamations,
    reclamationRatio: total > 0 ? reclamations / total : 0,
    averageClosureHours: durationCount > 0 ? durationSum / durationCount : null,
  }
}

/** Groups incidents by type and returns the most frequent ones (count desc, then name). */
export function topIncidentTypes(incidents: Incident[], limit = 6): IncidentTypeStat[] {
  const byType = new Map<string, IncidentTypeStat>()

  for (const incident of incidents) {
    const label = incident.incidentType || "Non renseigné"
    const stat = byType.get(label) ?? { label, total: 0, bt: 0, mt: 0, tone: "muted" as const }
    stat.total += 1
    if (incident.network === "BT") stat.bt += 1
    else stat.mt += 1
    byType.set(label, stat)
  }

  return [...byType.values()]
    .map((stat) => ({ ...stat, tone: typeTone(stat) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr"))
    .slice(0, limit)
}

/** Generic "other" buckets stay muted; otherwise the dominant network sets the colour, ties stay muted. */
function typeTone(stat: Pick<IncidentTypeStat, "label" | "bt" | "mt">): IncidentTypeStat["tone"] {
  if (/^autres?$/i.test(stat.label.trim())) return "muted"
  if (stat.bt > stat.mt) return "bt"
  if (stat.mt > stat.bt) return "mt"
  return "muted"
}

/** The most recent incidents, by incident date then by entry time. Input is not mutated. */
export function recentIncidents(incidents: Incident[], limit = 6): Incident[] {
  return [...incidents]
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, limit)
}

/** Number of incidents with a usable latitude and longitude. */
export function countMappedIncidents(incidents: Incident[]): number {
  return incidents.reduce((count, incident) => (Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) ? count + 1 : count), 0)
}

const hoursFormatter = new Intl.NumberFormat(APP_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Formats a duration in hours with one decimal, e.g. 3,0 h. Returns "—" when there is no value. */
export function formatHours(hours: number | null): string {
  return hours === null || !Number.isFinite(hours) ? "—" : `${hoursFormatter.format(hours)}\u00A0h`
}

const dayMonthFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
})

/** Formats an instant as "dd/mm · HH:mm" in Africa/Casablanca. */
export function formatDayMonthTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return `${dayMonthFormatter.format(date)} · ${formatTime(date)}`
}

/** Short axis label for a bucket day, dd/mm. */
export function dayShortLabel(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

/** Day key as dd/mm/yyyy. */
export function formatDayKey(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`
}

const dayLongFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
})

/** Long French label for a bucket day, e.g. jeudi 13 novembre. Noon UTC keeps the calendar day stable. */
export function dayLongLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number)
  return dayLongFormatter.format(new Date(Date.UTC(year, month - 1, day, 12)))
}

const CSV_HEADER = ["Date", "Réseau", "Type", "Commune", "Village", "Statut", "Réclamation", "Agent"]

/** Escapes one CSV cell for a semicolon-separated file (French Excel default) and neutralises spreadsheet formulas. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Builds the CSV export of incidents. The content starts with a UTF-8 byte order mark so Excel reads accents correctly.
 * Columns: date, réseau, type, commune, village, statut, réclamation, agent.
 */
export function buildIncidentsCsv(incidents: Incident[]): string {
  const rows = incidents.map((incident) => [
    formatDateTime(incident.date),
    incident.network,
    incident.incidentType,
    incident.commune,
    incident.village,
    incident.status === "open" ? "En cours" : "Clôturé",
    incident.reclamation ? "Oui" : "Non",
    incident.agentName ?? "",
  ])
  const lines = [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(";"))
  return `\uFEFF${lines.join("\r\n")}\r\n`
}
