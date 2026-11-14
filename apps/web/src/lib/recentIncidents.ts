import type { Network } from "@/data/incidents"

/** localStorage key holding the incidents opened most recently, newest first. */
export const RECENT_INCIDENTS_KEY = "intervx.recent.incidents"

/** Maximum number of recent incidents kept and shown. */
export const RECENT_INCIDENTS_LIMIT = 5

export type RecentIncident = {
  id: string
  label: string
  network: Network
  /** Epoch milliseconds of the last time the incident was opened. */
  at: number
}

export type RecentIncidentInput = Pick<RecentIncident, "id" | "label" | "network">

/** Single line used for an incident in the recents list: type, village and commune, skipping empty parts. */
export function incidentRecentLabel(parts: { incidentType: string; village: string; commune: string }): string {
  const label = [parts.incidentType, parts.village, parts.commune]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ")
  return label.length > 0 ? label : "Incident"
}

function isRecentIncident(value: unknown): value is RecentIncident {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    (item.network === "BT" || item.network === "MT") &&
    typeof item.at === "number" &&
    Number.isFinite(item.at)
  )
}

/** Recent incidents, newest first. Returns an empty list when storage is unavailable or holds invalid data. */
export function readRecentIncidents(): RecentIncident[] {
  try {
    const raw = window.localStorage.getItem(RECENT_INCIDENTS_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentIncident).slice(0, RECENT_INCIDENTS_LIMIT)
  } catch {
    return []
  }
}

/** Moves the incident to the front of the recent list (deduplicated by id) and trims the list to the limit. */
export function rememberIncident(entry: RecentIncidentInput): void {
  try {
    const next: RecentIncident = { id: entry.id, label: entry.label, network: entry.network, at: Date.now() }
    const others = readRecentIncidents().filter((item) => item.id !== entry.id)
    window.localStorage.setItem(
      RECENT_INCIDENTS_KEY,
      JSON.stringify([next, ...others].slice(0, RECENT_INCIDENTS_LIMIT)),
    )
  } catch {
    // Storage can be blocked or full; recents are a convenience, so the failure is ignored.
  }
}
