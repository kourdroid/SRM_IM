import type { IncidentStatus, Network } from "@/data/incidents"
import type { ReportExportRecord, ReportFilters } from "@/data/reports"
import { APP_TIME_ZONE } from "@/lib/format"

/** Value of every "all" option in the filter selects. */
export const ALL = "all"

export type PresetKey = "7d" | "30d" | "month" | "previousMonth"

export const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "month", label: "Mois en cours" },
  { value: "previousMonth", label: "Mois précédent" },
]

/** Raw form state. Selects keep string values; they are converted to nullable filters for queries. */
export type ReportFormState = {
  /** First day included (YYYY-MM-DD). */
  startDate: string
  /** Last day included (YYYY-MM-DD). */
  endDate: string
  /** Null when the dates were typed by hand. */
  preset: PresetKey | null
  communeId: string
  agentId: string
  network: typeof ALL | Network
  status: typeof ALL | IncidentStatus
  reclamation: typeof ALL | "yes" | "no"
}

const DAY_MS = 86_400_000

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Today's calendar day in the reporting time zone (YYYY-MM-DD). */
export function todayInAppZone(now: Date = new Date()): string {
  return dayFormatter.format(now)
}

/** Adds calendar days to a YYYY-MM-DD string. Calendar arithmetic only, so no time zone is involved. */
export function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10)
}

function monthStart(day: string): string {
  return `${day.slice(0, 8)}01`
}

export function presetRange(preset: PresetKey, today: string): { startDate: string; endDate: string } {
  if (preset === "7d") return { startDate: shiftDay(today, -6), endDate: today }
  if (preset === "30d") return { startDate: shiftDay(today, -29), endDate: today }
  if (preset === "month") return { startDate: monthStart(today), endDate: today }
  const previousEnd = shiftDay(monthStart(today), -1)
  return { startDate: monthStart(previousEnd), endDate: previousEnd }
}

/** Default view: the last 30 days, no other filter. */
export function createInitialForm(today: string): ReportFormState {
  return {
    ...presetRange("30d", today),
    preset: "30d",
    communeId: ALL,
    agentId: ALL,
    network: ALL,
    status: ALL,
    reclamation: ALL,
  }
}

/** Filters for the data layer: "all" becomes null. */
export function toReportFilters(form: ReportFormState): ReportFilters {
  return {
    startDate: form.startDate,
    endDate: form.endDate,
    communeId: form.communeId === ALL ? null : form.communeId,
    agentId: form.agentId === ALL ? null : form.agentId,
    type: form.network === ALL ? null : form.network,
    status: form.status === ALL ? null : form.status,
    reclamation: form.reclamation === ALL ? null : form.reclamation === "yes",
  }
}

/** Restores the filters of an earlier export so it can be generated again. */
export function formFromExport(record: ReportExportRecord): ReportFormState {
  const { filters } = record
  return {
    startDate: record.startDate,
    endDate: record.endDate,
    preset: null,
    communeId: filters.communeId ?? ALL,
    agentId: filters.agentId ?? ALL,
    network: filters.type ?? ALL,
    status: filters.status ?? ALL,
    reclamation: filters.reclamation === null ? ALL : filters.reclamation ? "yes" : "no",
  }
}

/** Message shown under the dates when the range cannot be queried, or null when it is usable. */
export function getRangeError(form: ReportFormState): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate)) {
    return "Choisissez une date de début et une date de fin."
  }
  if (form.startDate > form.endDate) {
    return "La date de début doit précéder la date de fin."
  }
  return null
}
