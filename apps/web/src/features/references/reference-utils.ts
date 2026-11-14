import { cleanLabel } from "@/data/incidents"
import type { MaterialUsage } from "@/data/references"
import { formatNumber } from "@/lib/format"

export type Direction = "up" | "down"
export type ListStatus = "loading" | "error" | "ready"

/** State of a create/rename dialog. `session` changes on every open so the form remounts with fresh fields. */
export type FormState<T> = {
  open: boolean
  item: T | null
  session: number
}

export type MaterialUsageEntry = {
  key: string
  label: string
  uses: number
  spellings: number
  inCatalog: boolean
}

export const NAME_MIN_LENGTH = 2

/** Message to show for a failed action; errors thrown by the data layer already carry a French sentence. */
export function errorMessage(error: unknown, fallback = "L'opération a échoué. Réessayez."): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Lowercase, accent-free key used for search and for matching typed names against the catalogue. */
export function normalizeKey(value: string): string {
  return cleanLabel(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr-FR")
}

/** Keeps the items where one of the searched fields contains the query (accent and case insensitive). */
export function filterByQuery<T>(items: readonly T[], query: string, fields: (item: T) => string[]): T[] {
  const needle = normalizeKey(query)
  if (needle === "") return [...items]
  return items.filter((item) => fields(item).some((field) => normalizeKey(field).includes(needle)))
}

/** "1 incident" / "3 incidents", with French thousands separators. */
export function incidentsLabel(count: number): string {
  return `${formatNumber(count)} ${count > 1 ? "incidents" : "incident"}`
}

/** "1 saisie" / "3 saisies". */
export function savedLabel(count: number): string {
  return `${formatNumber(count)} ${count > 1 ? "saisies" : "saisie"}`
}

/** "1 commune" / "28 communes". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

/** "26 départs · 25 actifs", the muted summary shown next to a list's search. */
export function activeSummary<T>(
  items: readonly T[],
  isActive: (item: T) => boolean,
  nouns: { singular: string; plural: string },
): string {
  const active = items.filter(isActive).length
  return `${countLabel(items.length, nouns.singular, nouns.plural)} · ${countLabel(active, "actif", "actifs")}`
}

/** Returns null when the name is usable, otherwise a message for the user. */
export function validateReferenceName(value: string, maxLength: number): string | null {
  if (value.length < NAME_MIN_LENGTH) return `Saisissez au moins ${NAME_MIN_LENGTH} caractères.`
  if (value.length > maxLength) return `Ne dépassez pas ${maxLength} caractères.`
  return null
}

/**
 * Rows whose sort order must be saved to move `id` one step up or down within `siblings`, which must be in
 * display order. Positions are written as sort orders, so an unordered list (all zeros) is fixed in one go.
 * Returns an empty list when the move is impossible or changes nothing.
 */
export function reorderChanges<T extends { id: string; sortOrder: number }>(
  siblings: readonly T[],
  id: string,
  direction: Direction,
): T[] {
  const index = siblings.findIndex((item) => item.id === id)
  const swapWith = direction === "up" ? index - 1 : index + 1
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return []

  const current = siblings[index]
  const neighbour = siblings[swapWith]
  if (!current || !neighbour) return []

  const reordered = [...siblings]
  reordered[index] = neighbour
  reordered[swapWith] = current

  return reordered.flatMap((item, position) => (item.sortOrder === position ? [] : [{ ...item, sortOrder: position }]))
}

/**
 * Groups the typed material names by their normalized key. Each group takes the spelling used most often as
 * its label. A group is "in catalogue" when its key matches a catalogue entry.
 */
export function buildMaterialUsageEntries(
  usage: readonly MaterialUsage[],
  catalogNames: readonly string[],
): MaterialUsageEntry[] {
  const catalogKeys = new Set(catalogNames.map((name) => normalizeKey(name)))
  const groups = new Map<string, MaterialUsageEntry>()
  const bestSpellingUses = new Map<string, number>()

  for (const row of usage) {
    const label = cleanLabel(row.materialName)
    const key = normalizeKey(label)
    if (key === "") continue

    const group = groups.get(key)
    if (!group) {
      groups.set(key, { key, label, uses: row.uses, spellings: 1, inCatalog: catalogKeys.has(key) })
      bestSpellingUses.set(key, row.uses)
      continue
    }

    group.uses += row.uses
    group.spellings += 1
    if (row.uses > (bestSpellingUses.get(key) ?? 0)) {
      group.label = label
      bestSpellingUses.set(key, row.uses)
    }
  }

  return [...groups.values()].sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label, "fr"))
}

/** Derives the status of a list from a query result. */
export function queryState(query: { isPending: boolean; isError: boolean; error: unknown }): {
  status: ListStatus
  detail?: string
} {
  if (query.isError) return { status: "error", detail: errorMessage(query.error, "Chargement impossible.") }
  if (query.isPending) return { status: "loading" }
  return { status: "ready" }
}

export function nextFormState<T>(previous: FormState<T>, item: T | null): FormState<T> {
  return { open: true, item, session: previous.session + 1 }
}
