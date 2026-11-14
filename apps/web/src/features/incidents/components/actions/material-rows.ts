import type { MaterialLine } from "@/data/incidentMutations"

/** Form model and validation for material lines, shared by the "Matériel" and "Clôturer" dialogs. */

/** Longest material name the server accepts. */
export const MATERIAL_NAME_MAX_LENGTH = 160

/** One editable line; `quantity` stays text while typing ("1,5" is valid French input). */
export type MaterialRow = {
  id: string
  name: string
  quantity: string
}

/** "Avec matériel" or "Aucun matériel utilisé". */
export type MaterialUsage = "with" | "none"

export type MaterialRowsResult = { ok: true; materials: MaterialLine[] } | { ok: false; error: string }

export function createMaterialRow(name = "", quantity = ""): MaterialRow {
  return { id: crypto.randomUUID(), name, quantity }
}

/** Turns stored lines into editable rows; quantities use a French decimal comma. */
export function rowsFromLines(lines: readonly MaterialLine[]): MaterialRow[] {
  return lines.map((line) => createMaterialRow(line.materialName, formatQuantity(line.quantity)))
}

export function normalizeMaterialName(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** Case- and accent-insensitive key, used to match a typed name against the catalog. */
export function materialKey(value: string): string {
  return normalizeMaterialName(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/**
 * Quantity with an optional "x" marker before or after the number, either "," or "." as the decimal
 * separator, and spaces around the number: "3", "3,5", " 3.5 ", "x3", "3x", "x 3,5", "3 x".
 */
const QUANTITY_PATTERN = /^(?:[x×]\s*)?(\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*[x×])?$/i

/** Parses a positive quantity. Accepts a French decimal comma, surrounding spaces and an "x" marker. Returns null when invalid. */
export function parseQuantity(input: string): number | null {
  const match = QUANTITY_PATTERN.exec(input.trim())
  if (!match) return null
  const parsed = Number(match[1].replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return ""
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")
}

/**
 * Checks every row and returns the material lines to send. Fully blank rows are ignored. A name that
 * matches the catalog (ignoring case and accents) is saved with the catalog spelling.
 */
export function readMaterialRows(rows: readonly MaterialRow[], catalog: readonly string[]): MaterialRowsResult {
  const materials: MaterialLine[] = []

  for (const row of rows) {
    const name = normalizeMaterialName(row.name)
    const quantityText = row.quantity.trim()
    if (name === "" && quantityText === "") continue

    if (name === "") return { ok: false, error: "Indiquez le nom de chaque matériel saisi." }
    if (name.length > MATERIAL_NAME_MAX_LENGTH) {
      return { ok: false, error: `Le nom du matériel ne doit pas dépasser ${MATERIAL_NAME_MAX_LENGTH} caractères.` }
    }

    const quantity = parseQuantity(quantityText)
    if (quantity === null) return { ok: false, error: `Indiquez une quantité positive pour « ${name} ».` }

    const catalogName = catalog.find((item) => materialKey(item) === materialKey(name))
    materials.push({ materialName: catalogName ?? name, quantity })
  }

  return { ok: true, materials }
}

/** True when two material lists hold the same names and quantities in the same order. */
export function sameMaterials(a: readonly MaterialLine[], b: readonly MaterialLine[]): boolean {
  if (a.length !== b.length) return false
  return a.every((line, index) => {
    const other = b[index]
    return materialKey(line.materialName) === materialKey(other.materialName) && line.quantity === other.quantity
  })
}
