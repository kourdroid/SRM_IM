/** localStorage key holding how often each palette entry was chosen, keyed by the entry's value. */
export const PALETTE_USAGE_KEY = "intervx.palette.usage"

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/** Usage counts per palette entry value. Returns an empty object when storage is unavailable or holds invalid data. */
export function readPaletteUsage(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(PALETTE_USAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => isCount(entry[1])))
  } catch {
    return {}
  }
}

/** Adds one to the stored count of the palette entry. Storage errors are ignored: usage only orders the palette. */
export function recordPaletteUsage(value: string): void {
  try {
    const usage = readPaletteUsage()
    window.localStorage.setItem(PALETTE_USAGE_KEY, JSON.stringify({ ...usage, [value]: (usage[value] ?? 0) + 1 }))
  } catch {
    // Storage can be blocked or full; the palette then keeps its default order.
  }
}

/** Copy of the items, most used first. Items with equal counts keep their original order. */
export function sortByUsage<T extends { value: string }>(items: readonly T[], usage: Readonly<Record<string, number>>): T[] {
  return [...items].sort((a, b) => (usage[b.value] ?? 0) - (usage[a.value] ?? 0))
}
