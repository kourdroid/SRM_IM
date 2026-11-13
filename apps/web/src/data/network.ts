import { useQuery } from "@tanstack/react-query"
import { cleanLabel } from "@/data/incidents"
import { supabase } from "@/lib/supabase"

/** HTA electricity network (postes sources and départ lines): read-only reference data, shared by the map. */

export type Position = [number, number]
export type LineString = { type: "LineString"; coordinates: Position[] }
export type MultiLineString = { type: "MultiLineString"; coordinates: Position[][] }

export type NetworkPoste = {
  id: string
  name: string
  longitude: number
  latitude: number
}

export type NetworkDepart = {
  id: string
  poste: string
  depart: string
  /** Name of the linked HTA option, when the départ has one. */
  appDepart: string | null
  aerialKm: number
  undergroundKm: number
  aerial: MultiLineString | null
  underground: MultiLineString | null
}

export type NetworkData = {
  postes: NetworkPoste[]
  departs: NetworkDepart[]
}

export type NetworkLineProperties = {
  departId: string
  poste: string
  depart: string
  label: string
  /** Length of this segment type (aerial or underground), rounded to 0.1 km. */
  km: number
  underground: boolean
  posteIndex: number
}

export type NetworkLineFeature = {
  type: "Feature"
  geometry: LineString | MultiLineString
  properties: NetworkLineProperties
}

export type NetworkLineCollection = { type: "FeatureCollection"; features: NetworkLineFeature[] }

export type NetworkPosteProperties = {
  id: string
  name: string
  posteIndex: number
}

export type NetworkPosteFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: Position }
  properties: NetworkPosteProperties
}

export type NetworkPosteCollection = { type: "FeatureCollection"; features: NetworkPosteFeature[] }

type PosteRow = {
  id: string
  name: string | null
  longitude: number | string | null
  latitude: number | string | null
}

type DepartRow = {
  id: string
  poste_source: string | null
  depart: string | null
  aerial_km: number | string | null
  underground_km: number | string | null
  aerial_geometry: unknown
  underground_geometry: unknown
  depart_hta_options: { name: string | null } | { name: string | null }[] | null
}

const POSTE_COLUMNS = "id, name, longitude, latitude"
const DEPART_COLUMNS =
  "id, poste_source, depart, aerial_km, underground_km, aerial_geometry, underground_geometry, depart_hta_options(name)"

const GC_TIME = 24 * 60 * 60 * 1000

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10
}

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

/** Accepts a stored GeoJSON MultiLineString and drops malformed parts; null when nothing usable is left. */
export function parseMultiLine(value: unknown): MultiLineString | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as { type?: unknown; coordinates?: unknown }
  if (candidate.type !== "MultiLineString" || !Array.isArray(candidate.coordinates)) return null

  const lines: Position[][] = []
  for (const line of candidate.coordinates as unknown[]) {
    if (!Array.isArray(line)) continue
    const positions = line.filter(isPosition)
    if (positions.length > 0) lines.push(positions)
  }
  return lines.length > 0 ? { type: "MultiLineString", coordinates: lines } : null
}

function embeddedOptionName(row: DepartRow): string | null {
  // PostgREST returns an embedded relation as an object or as a one-element array depending on the join.
  const option = Array.isArray(row.depart_hta_options) ? row.depart_hta_options[0] : row.depart_hta_options
  const name = cleanLabel(option?.name)
  return name || null
}

async function fetchPostes(): Promise<NetworkPoste[]> {
  const { data, error } = await supabase.from("network_postes").select(POSTE_COLUMNS)
  if (error) throw new Error(`Chargement des postes impossible : ${error.message}`)

  const postes: NetworkPoste[] = []
  for (const row of (data ?? []) as unknown as PosteRow[]) {
    const longitude = toFiniteNumber(row.longitude)
    const latitude = toFiniteNumber(row.latitude)
    if (longitude === null || latitude === null) continue
    postes.push({ id: row.id, name: cleanLabel(row.name) || "Poste inconnu", longitude, latitude })
  }
  return postes.sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

async function fetchDeparts(): Promise<NetworkDepart[]> {
  const { data, error } = await supabase.from("network_departs").select(DEPART_COLUMNS)
  if (error) throw new Error(`Chargement des départs impossible : ${error.message}`)

  const departs = ((data ?? []) as unknown as DepartRow[]).map((row): NetworkDepart => ({
    id: row.id,
    poste: cleanLabel(row.poste_source) || "Poste inconnu",
    depart: cleanLabel(row.depart) || "Départ inconnu",
    appDepart: embeddedOptionName(row),
    aerialKm: toFiniteNumber(row.aerial_km) ?? 0,
    undergroundKm: toFiniteNumber(row.underground_km) ?? 0,
    aerial: parseMultiLine(row.aerial_geometry),
    underground: parseMultiLine(row.underground_geometry),
  }))

  return departs.sort(
    (a, b) => a.poste.localeCompare(b.poste, "fr") || a.depart.localeCompare(b.depart, "fr", { numeric: true }),
  )
}

/** Postes and départs in parallel; RLS limits rows to admins and directors. */
export async function fetchNetwork(): Promise<NetworkData> {
  const [postes, departs] = await Promise.all([fetchPostes(), fetchDeparts()])
  return { postes, departs }
}

/** Network data, fetched the first time the layer is switched on and kept for the session. */
export function useNetwork(enabled: boolean) {
  return useQuery({
    queryKey: ["network"],
    queryFn: fetchNetwork,
    enabled,
    staleTime: Infinity,
    gcTime: GC_TIME,
  })
}

/** Stable index of every poste name (both tables, sorted), used to pick the poste color. */
export function buildPosteIndex(data: NetworkData | undefined): Map<string, number> {
  const names = new Set<string>()
  for (const poste of data?.postes ?? []) names.add(poste.name)
  for (const depart of data?.departs ?? []) names.add(depart.poste)
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "fr"))
  return new Map(sorted.map((name, index) => [name, index]))
}

/** Each départ gives one feature per segment type (aerial, underground) that has geometry. */
export function toNetworkLines(departs: NetworkDepart[], posteIndex: ReadonlyMap<string, number>): NetworkLineCollection {
  const features: NetworkLineFeature[] = []
  for (const depart of departs) {
    const posteIdx = posteIndex.get(depart.poste) ?? 0
    const segments = [
      { geometry: depart.aerial, km: depart.aerialKm, underground: false },
      { geometry: depart.underground, km: depart.undergroundKm, underground: true },
    ]
    for (const segment of segments) {
      if (!segment.geometry) continue
      features.push({
        type: "Feature",
        geometry: segment.geometry,
        properties: {
          departId: depart.id,
          poste: depart.poste,
          depart: depart.depart,
          label: `${depart.poste} · ${depart.depart}`,
          km: roundKm(segment.km),
          underground: segment.underground,
          posteIndex: posteIdx,
        },
      })
    }
  }
  return { type: "FeatureCollection", features }
}

export function toPostePoints(postes: NetworkPoste[], posteIndex: ReadonlyMap<string, number>): NetworkPosteCollection {
  return {
    type: "FeatureCollection",
    features: postes.map((poste) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [poste.longitude, poste.latitude] },
      properties: { id: poste.id, name: poste.name, posteIndex: posteIndex.get(poste.name) ?? 0 },
    })),
  }
}

/** Bounding box [[west, south], [east, north]] of one départ's lines, or null when it has none. */
export function departBounds(lines: NetworkLineCollection, departId: string): [[number, number], [number, number]] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const feature of lines.features) {
    if (feature.properties.departId !== departId) continue
    const positions = feature.geometry.type === "LineString" ? feature.geometry.coordinates : feature.geometry.coordinates.flat()
    for (const [lon, lat] of positions) {
      west = Math.min(west, lon)
      east = Math.max(east, lon)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
    }
  }
  if (!Number.isFinite(west)) return null
  return [
    [west, south],
    [east, north],
  ]
}

/** Départs grouped by poste, keeping the input order (already sorted by poste). */
export function groupDepartsByPoste(departs: NetworkDepart[]): { poste: string; departs: NetworkDepart[] }[] {
  const groups = new Map<string, NetworkDepart[]>()
  for (const depart of departs) {
    const list = groups.get(depart.poste)
    if (list) list.push(depart)
    else groups.set(depart.poste, [depart])
  }
  return [...groups].map(([poste, list]) => ({ poste, departs: list }))
}
