import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { cleanLabel, useCommunes, type Commune, type IncidentStatus, type Network } from "@/data/incidents"
import { supabase } from "@/lib/supabase"
import { normalizeSearchText } from "@/lib/text"

/** Incident search for the global search box: server-side text match plus client-side commune match. */

/** Searches start once the trimmed query has this many characters. */
export const INCIDENT_SEARCH_MIN_LENGTH = 2
/** Maximum number of incident hits returned for one query. */
export const INCIDENT_SEARCH_LIMIT = 8

export type IncidentSearchHit = {
  id: string
  network: Network
  incidentType: string
  village: string
  commune: string
  /** incident date, ISO string as stored in `date` */
  date: string
  status: IncidentStatus
}

type IncidentSearchRow = {
  id: string
  type: Network
  date: string
  status: IncidentStatus
  incident_type: string
  village: string | null
  commune_id: string | null
  communes: { name: string | null } | { name: string | null }[] | null
}

/** Wraps a value in PostgREST double quotes for use inside .or(...) or in.(...) lists. Escapes backslash and double quote. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`
}

/** Builds the ilike pattern "%term%": removes the PostgREST wildcard "*", escapes LIKE specials (backslash, %, _) with a backslash, then quotes it with quoteFilterValue. */
export function toOrFilterPattern(term: string): string {
  const literal = term.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&")
  return quoteFilterValue(`%${literal}%`)
}

/** Builds the full .or() filter string: village, incident_type, depart_hta, description with ilike the pattern, plus commune_id.in.(quoted ids) when communeIds is non-empty. */
export function buildIncidentSearchOr(term: string, communeIds: readonly string[]): string {
  const pattern = toOrFilterPattern(term)
  const filters = [
    `village.ilike.${pattern}`,
    `incident_type.ilike.${pattern}`,
    `depart_hta.ilike.${pattern}`,
    `description.ilike.${pattern}`,
  ]
  if (communeIds.length > 0) {
    filters.push(`commune_id.in.(${communeIds.map(quoteFilterValue).join(",")})`)
  }
  return filters.join(",")
}

/** Client-side commune match: keeps communes whose normalizeSearchText(name) includes normalizeSearchText(query). Communes starting with the query come first, then the rest, both in input order. Returns at most `limit` items. An empty query returns []. */
export function matchCommunes(communes: readonly Commune[], query: string, limit: number): Commune[] {
  const needle = normalizeSearchText(query)
  if (needle === "") return []

  const startsWith: Commune[] = []
  const contains: Commune[] = []
  for (const commune of communes) {
    const name = normalizeSearchText(commune.name)
    if (name.startsWith(needle)) {
      startsWith.push(commune)
    } else if (name.includes(needle)) {
      contains.push(commune)
    }
  }
  return [...startsWith, ...contains].slice(0, limit)
}

/** Runs the incident text search, restricted to the matched communes, newest incident first. */
async function searchIncidents(term: string, matchedCommunes: readonly Commune[]): Promise<IncidentSearchHit[]> {
  const communeIds = matchedCommunes.map((commune) => commune.id)
  const { data, error } = await supabase
    .from("incidents")
    .select("id, type, date, status, incident_type, village, commune_id, communes(name)")
    .is("archived_at", null)
    .or(buildIncidentSearchOr(term, communeIds))
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(INCIDENT_SEARCH_LIMIT)
  if (error) throw new Error(`Recherche des incidents impossible : ${error.message}`)

  return ((data ?? []) as unknown as IncidentSearchRow[]).map((row) => {
    const commune = Array.isArray(row.communes) ? row.communes[0] : row.communes
    return {
      id: row.id,
      network: row.type,
      incidentType: cleanLabel(row.incident_type),
      village: cleanLabel(row.village),
      commune: cleanLabel(commune?.name) || "Commune inconnue",
      date: row.date,
      status: row.status,
    }
  })
}

/** TanStack Query hook. `query` is the already-debounced raw text from the caller; it is trimmed inside. */
export function useIncidentSearch(query: string, enabled: boolean) {
  // "*" is a PostgREST wildcard, so it never counts as text: "**" must not search for everything.
  const term = query.replace(/\*/g, " ").trim()
  const communes = useCommunes()
  const active = enabled && term.length >= INCIDENT_SEARCH_MIN_LENGTH && !communes.isPending

  return useQuery({
    queryKey: ["search", "incidents", term],
    enabled: active,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    queryFn: () => searchIncidents(term, matchCommunes(communes.data ?? [], term, Number.POSITIVE_INFINITY)),
  })
}
