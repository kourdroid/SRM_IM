import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { FunctionsHttpError } from "@supabase/supabase-js"

import { cleanLabel, type IncidentStatus, type Network } from "@/data/incidents"
import { APP_TIME_ZONE } from "@/lib/format"
import { throwIfError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/**
 * Reporting data layer: the same RPCs and export function the mobile supervision reports use.
 * Days are interpreted in Africa/Casablanca, so a report day matches what agents see in the field.
 */

export type ReportFilters = {
  /** First day included (YYYY-MM-DD). */
  startDate: string
  /** Last day included (YYYY-MM-DD). */
  endDate: string
  communeId: string | null
  agentId: string | null
  type: Network | null
  status: IncidentStatus | null
  /** null means "all". */
  reclamation: boolean | null
}

export type ReportRpcParams = {
  p_start_date: string
  p_end_date: string
  p_commune_id: string | null
  p_agent_id: string | null
  p_type: string | null
  p_status: string | null
  p_reclamation: boolean | null
}

export type ReportSummary = {
  total: number
  open: number
  closed: number
  reclamations: number
  bt: number
  mt: number
  missingGps: number
  missingPhoto: number
  avgClosureDays: number
  maxClosureDays: number
}

export type ReportPoint = { label: string; value: number }

export type ReportBreakdowns = {
  /** Labels are "YYYY-MM". */
  monthly: ReportPoint[]
  byCommune: ReportPoint[]
  byAgent: ReportPoint[]
  byIncidentType: ReportPoint[]
  byDepartHta: ReportPoint[]
  byMaterialQuantity: ReportPoint[]
}

export type ReportRow = {
  id: string
  type: Network
  status: IncidentStatus
  incidentType: string
  departHta: string | null
  communeName: string | null
  village: string | null
  agentName: string | null
  reclamation: boolean
  createdAt: string
  closedAt: string | null
  closureHours: number | null
  latitude: number | null
  longitude: number | null
  mediaCount: number
}

export type ReportAgent = { id: string; name: string }

export type ReportExportStatus = "pending" | "running" | "done" | "failed"

export type ReportExportFilters = {
  communeId: string | null
  agentId: string | null
  type: Network | null
  status: IncidentStatus | null
  reclamation: boolean | null
}

export type ReportExportRecord = {
  id: string
  status: ReportExportStatus
  startDate: string
  endDate: string
  rowCount: number
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
  filters: ReportExportFilters
}

export type ReportExportResult = { downloadUrl: string; rowCount: number }

/** Rows per page in the preview table. */
export const REPORT_PAGE_SIZE = 25

/** Longest range, in days, drawn with one bar per day. Longer ranges are drawn by month. */
export const DAILY_CHART_MAX_DAYS = 62

/** Incident count for one calendar day (YYYY-MM-DD, Africa/Casablanca), split by network. */
export type ReportDailyPoint = { day: string; bt: number; mt: number }

const DAY_MS = 86_400_000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const EXPORT_NAME_PREFIX = "rapport-incidents"
const DAILY_PAGE_SIZE = 1000

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** en-CA formats as YYYY-MM-DD, which is the day key used across the reports. */
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Parses YYYY-MM-DD as a UTC instant, rejecting impossible calendar dates. */
function parseDay(day: string): number | null {
  if (!DAY_PATTERN.test(day)) return null
  const instant = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== day) return null
  return instant
}

/** Returns the ISO instant of local midnight in APP_TIME_ZONE for the calendar day given as a UTC instant. */
function zonedMidnight(dayInstant: number): string {
  let instant = dayInstant
  for (let pass = 0; pass < 3; pass += 1) {
    const parts: Record<string, string> = Object.fromEntries(
      zonedFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    )
    const displayed = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    const next = instant + dayInstant - displayed
    if (next === instant) break
    instant = next
  }
  return new Date(instant).toISOString()
}

/** Half-open [start, end) instants covering the inclusive day range, or null when the range is invalid. */
export function reportDateRange(startDate: string, endDate: string): { start: string; end: string } | null {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (start === null || end === null || end < start) return null
  return { start: zonedMidnight(start), end: zonedMidnight(end + DAY_MS) }
}

/** Number of calendar days in the inclusive range, or null when the range is invalid. */
export function reportDayCount(startDate: string, endDate: string): number | null {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (start === null || end === null || end < start) return null
  return Math.round((end - start) / DAY_MS) + 1
}

/** RPC parameters for a filter set, or null when the dates are invalid (queries stay disabled). */
export function buildRpcParams(filters: ReportFilters): ReportRpcParams | null {
  const range = reportDateRange(filters.startDate, filters.endDate)
  if (!range) return null
  return {
    p_start_date: range.start,
    p_end_date: range.end,
    p_commune_id: filters.communeId,
    p_agent_id: filters.agentId,
    p_type: filters.type,
    p_status: filters.status,
    p_reclamation: filters.reclamation,
  }
}

function requireParams(params: ReportRpcParams | null): ReportRpcParams {
  if (!params) throw new Error("Période invalide : la date de début doit précéder la date de fin.")
  return params
}

/** Summary KPIs for the filtered period. */
export function useReportSummary(params: ReportRpcParams | null) {
  return useQuery({
    queryKey: ["reports", "summary", params],
    enabled: params !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_incident_report_summary", requireParams(params))
      throwIfError(error, "Le résumé du rapport n'a pas pu être chargé.")
      return parseSummary(data)
    },
  })
}

/** Breakdowns (monthly trend, communes, agents, types, departs, materials) for the filtered period. */
export function useReportBreakdowns(params: ReportRpcParams | null) {
  return useQuery({
    queryKey: ["reports", "breakdowns", params],
    enabled: params !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_incident_report_breakdowns", requireParams(params))
      throwIfError(error, "Les répartitions n'ont pas pu être chargées.")
      return parseBreakdowns(data)
    },
  })
}

/** One page of incident rows for the preview table (page is zero-based). */
export function useReportRows(params: ReportRpcParams | null, page: number) {
  return useQuery({
    queryKey: ["reports", "rows", params, page],
    enabled: params !== null,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_incident_report_rows", {
        ...requireParams(params),
        p_limit: REPORT_PAGE_SIZE,
        p_offset: page * REPORT_PAGE_SIZE,
      })
      throwIfError(error, "L'aperçu des incidents n'a pas pu être chargé.")
      return Array.isArray(data) ? data.map(parseRow) : []
    },
  })
}

/**
 * Incidents per calendar day for the daily chart. Counts the same rows as the RPCs (created_at inside the range,
 * archived rows excluded, same filters), so the bars add up to the KPI total. Pages through the table because
 * PostgREST caps each response. Only used for ranges up to DAILY_CHART_MAX_DAYS.
 */
export function useReportDaily(params: ReportRpcParams | null) {
  return useQuery({
    queryKey: ["reports", "daily", params],
    enabled: params !== null,
    queryFn: () => fetchDailyCounts(requireParams(params)),
  })
}

async function fetchDailyCounts(params: ReportRpcParams): Promise<ReportDailyPoint[]> {
  const counts = new Map<string, ReportDailyPoint>()

  for (let offset = 0; ; offset += DAILY_PAGE_SIZE) {
    let query = supabase
      .from("incidents")
      .select("id, type, created_at")
      .is("archived_at", null)
      .gte("created_at", params.p_start_date)
      .lt("created_at", params.p_end_date)
    if (params.p_commune_id) query = query.eq("commune_id", params.p_commune_id)
    if (params.p_agent_id) query = query.eq("created_by", params.p_agent_id)
    if (params.p_type) query = query.eq("type", params.p_type)
    if (params.p_status) query = query.eq("status", params.p_status)
    if (params.p_reclamation !== null) query = query.eq("reclamation", params.p_reclamation)

    const { data, error } = await query.order("id").range(offset, offset + DAILY_PAGE_SIZE - 1)
    throwIfError(error, "Les incidents par jour n'ont pas pu être chargés.")

    const rows: unknown[] = Array.isArray(data) ? data : []
    for (const value of rows) {
      const record = asRecord(value)
      const instant = Date.parse(asText(record.created_at))
      if (!Number.isFinite(instant)) continue
      const day = dayKeyFormatter.format(new Date(instant))
      const point = counts.get(day) ?? { day, bt: 0, mt: 0 }
      if (asNetwork(record.type) === "BT") point.bt += 1
      else point.mt += 1
      counts.set(day, point)
    }

    if (rows.length < DAILY_PAGE_SIZE) break
  }

  return [...counts.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/** Active agents (admins and directors see every profile through this RPC), sorted by name. */
export function useReportAgents() {
  return useQuery({
    queryKey: ["reports", "agents"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ReportAgent[]> => {
      const { data, error } = await supabase.rpc("get_supervision_profiles")
      throwIfError(error, "La liste des agents n'a pas pu être chargée.")
      return (Array.isArray(data) ? data : [])
        .map(parseAgent)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    },
  })
}

/** The ten most recent exports requested by the current user. */
export function useReportExports() {
  return useQuery({
    queryKey: ["reports", "exports"],
    queryFn: async (): Promise<ReportExportRecord[]> => {
      const { data, error } = await supabase
        .from("report_exports")
        .select("id, status, start_date, end_date, row_count, filters, error_message, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(10)
      throwIfError(error, "Les exports récents n'ont pas pu être chargés.")
      return (Array.isArray(data) ? data : []).map(parseExportRecord)
    },
  })
}

/**
 * Runs the server-side Excel export and returns the signed download link it produced.
 * Filters that are "all" are omitted from the body (the function rejects null for type and status).
 */
export async function requestReportExport(filters: ReportFilters): Promise<ReportExportResult> {
  const { data, error } = await supabase.functions.invoke("generate-report-export", {
    body: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      communeId: filters.communeId ?? undefined,
      agentId: filters.agentId ?? undefined,
      type: filters.type ?? undefined,
      status: filters.status ?? undefined,
      reclamation: filters.reclamation ?? undefined,
    },
  })

  if (error) {
    const detail = await readFunctionErrorMessage(error)
    throw new Error(detail ?? "L'export Excel a échoué. Vérifiez votre connexion et réessayez.")
  }

  const record = asRecord(data)
  const downloadUrl = asText(record.downloadUrl)
  if (!downloadUrl) {
    throw new Error("Le serveur n'a pas renvoyé de lien de téléchargement.")
  }
  return { downloadUrl, rowCount: asNumber(record.rowCount) }
}

/** Suggested file name for a downloaded export, e.g. rapport-incidents-2026-11-01-2026-11-14.xlsx. */
export function reportExportFileName(filters: ReportFilters): string {
  return `${EXPORT_NAME_PREFIX}-${filters.startDate}-${filters.endDate}.xlsx`
}

/** The function answers errors with a JSON body carrying a French message; read it when present. */
async function readFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  const response: unknown = error.context
  if (!(response instanceof Response)) return null
  try {
    const body: unknown = await response.json()
    return asText(asRecord(body).error) || null
  } catch {
    return null
  }
}

function parseSummary(value: unknown): ReportSummary {
  const record = asRecord(value)
  return {
    total: asNumber(record.total),
    open: asNumber(record.open),
    closed: asNumber(record.closed),
    reclamations: asNumber(record.reclamations),
    bt: asNumber(record.bt),
    mt: asNumber(record.mt),
    missingGps: asNumber(record.missingGps),
    missingPhoto: asNumber(record.missingPhoto),
    avgClosureDays: asNumber(record.avgClosureDays),
    maxClosureDays: asNumber(record.maxClosureDays),
  }
}

function parseBreakdowns(value: unknown): ReportBreakdowns {
  const record = asRecord(value)
  return {
    monthly: parsePoints(record.monthly),
    byCommune: parsePoints(record.byCommune),
    byAgent: parsePoints(record.byAgent),
    byIncidentType: parsePoints(record.byIncidentType),
    byDepartHta: parsePoints(record.byDepartHta),
    byMaterialQuantity: parsePoints(record.byMaterialQuantity),
  }
}

function parsePoints(value: unknown): ReportPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = asRecord(item)
    return { label: cleanLabel(asText(record.label)), value: asNumber(record.value) }
  })
}

function parseRow(value: unknown): ReportRow {
  const record = asRecord(value)
  return {
    id: asText(record.id),
    type: asNetwork(record.type),
    status: record.status === "closed" ? "closed" : "open",
    incidentType: cleanLabel(asText(record.incident_type)),
    departHta: asNullableLabel(record.depart_hta),
    communeName: asNullableLabel(record.commune_name),
    village: asNullableLabel(record.village),
    agentName: asNullableLabel(record.agent_name),
    reclamation: record.reclamation === true,
    createdAt: asText(record.created_at),
    closedAt: asNullableText(record.closed_at),
    closureHours: asNullableNumber(record.closure_duration_hours),
    latitude: asNullableNumber(record.latitude),
    longitude: asNullableNumber(record.longitude),
    mediaCount: asNumber(record.media_count),
  }
}

function parseAgent(value: unknown): ReportAgent {
  const record = asRecord(value)
  return {
    id: asText(record.id),
    name: cleanLabel(asText(record.name)) || "Agent sans nom",
  }
}

function parseExportRecord(value: unknown): ReportExportRecord {
  const record = asRecord(value)
  return {
    id: asText(record.id),
    status: parseExportStatus(record.status),
    startDate: asText(record.start_date),
    endDate: asText(record.end_date),
    rowCount: asNumber(record.row_count),
    createdAt: asText(record.created_at),
    completedAt: asNullableText(record.completed_at),
    errorMessage: asNullableText(record.error_message),
    filters: parseExportFilters(record.filters),
  }
}

function parseExportStatus(value: unknown): ReportExportStatus {
  return value === "done" || value === "failed" || value === "running" ? value : "pending"
}

function parseExportFilters(value: unknown): ReportExportFilters {
  const record = asRecord(value)
  return {
    communeId: asNullableText(record.communeId),
    agentId: asNullableText(record.agentId),
    type: record.type === "BT" || record.type === "MT" ? record.type : null,
    status: record.status === "open" || record.status === "closed" ? record.status : null,
    reclamation: typeof record.reclamation === "boolean" ? record.reclamation : null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asNetwork(value: unknown): Network {
  return value === "MT" ? "MT" : "BT"
}

function asNumber(value: unknown): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNullableLabel(value: unknown): string | null {
  return cleanLabel(asText(value)) || null
}
