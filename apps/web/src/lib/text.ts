/**
 * Normalizes text for search: lowercase, accents removed, whitespace collapsed,
 * so "Ménard" and "menard" compare equal.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}
