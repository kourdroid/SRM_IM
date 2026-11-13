import type { Incident, Network } from "@/data/incidents"
import type { PeriodKey } from "@/data/filters"
import { APP_TIME_ZONE } from "@/lib/format"

/** An incident with a usable position (only these are drawn on the map). */
export type PositionedIncident = Incident & { latitude: number; longitude: number }

/** Map layer mode: individual points (clustered) or density heatmap. */
export type MapMode = "points" | "heat"

/** Province bounds as [[west, south], [east, north]] in lon/lat. */
export const PROVINCE_BOUNDS: [[number, number], [number, number]] = [
  [-9.1, 32.3],
  [-8.0, 32.9],
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Number of day bars shown in the replay strip for each period preset. */
const PERIOD_DAYS: Record<PeriodKey, number> = { today: 1, "7d": 7, "14d": 14, "30d": 30, all: 30 }

export function hasPosition(incident: Incident): incident is PositionedIncident {
  return (
    typeof incident.latitude === "number" &&
    typeof incident.longitude === "number" &&
    Number.isFinite(incident.latitude) &&
    Number.isFinite(incident.longitude)
  )
}

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Local day of a timestamp in Africa/Casablanca, as YYYY-MM-DD. */
export function dayKeyOf(value: string | Date): string {
  return dayKeyFormatter.format(value instanceof Date ? value : new Date(value))
}

/** Day keys (ascending) ending today, one per bar of the replay strip. */
export function dayKeysForPeriod(period: PeriodKey, now: Date): string[] {
  const count = PERIOD_DAYS[period]
  const keys: string[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    keys.push(dayKeyOf(new Date(now.getTime() - offset * DAY_MS)))
  }
  return keys
}

/** "2026-11-13" -> "13/11". */
export function shortDayLabel(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

export type DayBucket = { key: string; count: number; isPeak: boolean }

/**
 * Counts positioned incidents per local day, zero days included.
 * A peak is a non-empty day at least twice the average over the displayed days.
 */
export function buildDayBuckets(incidents: Incident[], keys: string[]): DayBucket[] {
  const counts = new Map<string, number>(keys.map((key) => [key, 0]))
  for (const incident of incidents) {
    const key = dayKeyOf(incident.date)
    const current = counts.get(key)
    if (current !== undefined) counts.set(key, current + 1)
  }

  const values = keys.map((key) => counts.get(key) ?? 0)
  const total = values.reduce((sum, value) => sum + value, 0)
  const average = keys.length > 0 ? total / keys.length : 0

  return keys.map((key, index) => {
    const count = values[index] ?? 0
    return { key, count, isPeak: count > 0 && count >= 2 * average }
  })
}

/** Keeps the incidents declared on one local day (YYYY-MM-DD), or all when the day is null. */
export function filterByDay<T extends Incident>(incidents: T[], dayKey: string | null): T[] {
  if (!dayKey) return incidents
  return incidents.filter((incident) => dayKeyOf(incident.date) === dayKey)
}

/** Bounding box of the positioned incidents, or null when there are none. */
export function boundsOf(incidents: PositionedIncident[]): [[number, number], [number, number]] | null {
  if (incidents.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const incident of incidents) {
    west = Math.min(west, incident.longitude)
    east = Math.max(east, incident.longitude)
    south = Math.min(south, incident.latitude)
    north = Math.max(north, incident.latitude)
  }
  return [
    [west, south],
    [east, north],
  ]
}

export type PointFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: { id: string; network: Network }
}

export type PointCollection = { type: "FeatureCollection"; features: PointFeature[] }

/** GeoJSON (lon, lat) collection used by the incident sources. */
export function toPointCollection(incidents: PositionedIncident[]): PointCollection {
  return {
    type: "FeatureCollection",
    features: incidents.map((incident) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [incident.longitude, incident.latitude] },
      properties: { id: incident.id, network: incident.network },
    })),
  }
}
