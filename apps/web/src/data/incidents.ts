import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

/** Shared incident data layer: every page (overview, map, incidents) reads incidents through here. */

export type Network = "BT" | "MT"
export type IncidentStatus = "open" | "closed"

export type Incident = {
  id: string
  network: Network
  /** When the incident happened (entered by the field agent). */
  date: string
  /** When the record reached the server (late entries have a big gap with `date`). */
  createdAt: string
  closedAt: string | null
  status: IncidentStatus
  incidentType: string
  departHta: string | null
  communeId: string | null
  commune: string
  village: string
  reclamation: boolean
  createdBy: string | null
  agentName: string | null
  latitude: number | null
  longitude: number | null
}

export type IncidentFilters = {
  /** Inclusive lower bound on the incident date (ISO). */
  from?: string
  /** Exclusive upper bound on the incident date (ISO). */
  to?: string
  network?: Network
  status?: IncidentStatus
  communeId?: string
  incidentType?: string
}

// Zero-width spaces/joiners and BOM, written as escapes so the source stays readable.
const INVISIBLE_CHARS = new RegExp("[\u200B-\u200D\uFEFF]", "g")

/** Strips invisible characters (zero-width spaces, stray line breaks) found in some reference names. */
export function cleanLabel(value: string | null | undefined): string {
  return (value ?? "").replace(INVISIBLE_CHARS, "").replace(/\s+/g, " ").trim()
}

/** An entry is "late" when it reached the server more than 2 hours after the incident date. */
export function isLateEntry(incident: Pick<Incident, "date" | "createdAt">): boolean {
  return new Date(incident.createdAt).getTime() - new Date(incident.date).getTime() > 2 * 60 * 60 * 1000
}

type IncidentRow = {
  id: string
  type: Network
  date: string
  created_at: string
  closed_at: string | null
  status: IncidentStatus
  incident_type: string
  depart_hta: string | null
  commune_id: string | null
  village: string | null
  reclamation: boolean | null
  created_by: string | null
  latitude: number | null
  longitude: number | null
  communes: { name: string | null } | { name: string | null }[] | null
}

const INCIDENT_COLUMNS =
  "id, type, date, created_at, closed_at, status, incident_type, depart_hta, commune_id, village, reclamation, created_by, latitude, longitude, communes(name)"

async function fetchAgentNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("get_supervision_profiles")
  if (error) return new Map()
  return new Map(((data ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, cleanLabel(p.name) || "Agent"]))
}

/** Fetches incidents matching the filters, newest incident date first. RLS limits rows to admins/directors. */
export async function fetchIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
  let query = supabase.from("incidents").select(INCIDENT_COLUMNS).order("date", { ascending: false }).order("id", { ascending: false })
  if (filters.from) query = query.gte("date", filters.from)
  if (filters.to) query = query.lt("date", filters.to)
  if (filters.network) query = query.eq("type", filters.network)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.communeId) query = query.eq("commune_id", filters.communeId)
  if (filters.incidentType) query = query.eq("incident_type", filters.incidentType)

  const [{ data, error }, names] = await Promise.all([query.limit(5000), fetchAgentNames()])
  if (error) throw new Error(`Chargement des incidents impossible : ${error.message}`)

  return ((data ?? []) as unknown as IncidentRow[]).map((row) => {
    const commune = Array.isArray(row.communes) ? row.communes[0] : row.communes
    return {
      id: row.id,
      network: row.type,
      date: row.date,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      status: row.status,
      incidentType: cleanLabel(row.incident_type),
      departHta: row.depart_hta ? cleanLabel(row.depart_hta) : null,
      communeId: row.commune_id,
      commune: cleanLabel(commune?.name) || "Commune inconnue",
      village: cleanLabel(row.village),
      reclamation: row.reclamation === true,
      createdBy: row.created_by,
      agentName: row.created_by ? names.get(row.created_by) ?? null : null,
      latitude: row.latitude,
      longitude: row.longitude,
    }
  })
}

/** React Query hook shared by every page; identical filters share one cached request. */
export function useIncidents(filters: IncidentFilters = {}) {
  return useQuery({ queryKey: ["incidents", filters], queryFn: () => fetchIncidents(filters) })
}

export type Commune = { id: string; name: string }

/** Communes for filter menus, cleaned of invisible characters and sorted by name. */
export function useCommunes() {
  return useQuery({
    queryKey: ["communes"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Commune[]> => {
      const { data, error } = await supabase.from("communes").select("id, name")
      if (error) throw new Error(`Chargement des communes impossible : ${error.message}`)
      return ((data ?? []) as Commune[])
        .map((c) => ({ id: c.id, name: cleanLabel(c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    },
  })
}
