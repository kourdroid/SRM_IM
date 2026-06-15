export interface IncidentMaterialInput {
  client_material_id: string;
  material_name: string;
  quantity: number;
}

export interface MaterialFormRow {
  id: string;
  materialName: string;
  quantity: string;
}

export function createMaterialClientId(): string {
  return `material-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyMaterialFormRow(): MaterialFormRow {
  return {
    id: createMaterialClientId(),
    materialName: '',
    quantity: '',
  };
}

export function normalizeMaterialName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function parseQuantityInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatMaterialQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function buildEquipmentSummary(materials: IncidentMaterialInput[]): string {
  return materials
    .map((material) => `${material.material_name} x${formatMaterialQuantity(material.quantity)}`)
    .join(', ');
}

export function normalizeMaterialRows(rows: MaterialFormRow[]): IncidentMaterialInput[] | null {
  const materials: IncidentMaterialInput[] = [];

  for (const row of rows) {
    const materialName = normalizeMaterialName(row.materialName);
    const quantity = parseQuantityInput(row.quantity);
    const isBlank = materialName.length === 0 && row.quantity.trim().length === 0;
    if (isBlank) {
      continue;
    }
    if (materialName.length === 0 || quantity === null) {
      return null;
    }
    materials.push({
      client_material_id: row.id,
      material_name: materialName,
      quantity,
    });
  }

  return materials;
}

export function materialInputsToFormRows(
  materials: Pick<IncidentMaterialInput, 'client_material_id' | 'material_name' | 'quantity'>[]
): MaterialFormRow[] {
  if (materials.length === 0) {
    return [createEmptyMaterialFormRow()];
  }
  return materials.map((material) => ({
    id: material.client_material_id,
    materialName: material.material_name,
    quantity: formatMaterialQuantity(material.quantity),
  }));
}

export function formatMaterialsSummary(
  materials: Pick<IncidentMaterialInput, 'material_name' | 'quantity'>[],
  fallback = ''
): string {
  if (materials.length === 0) return fallback;
  return materials
    .map((material) => `${material.material_name} x${formatMaterialQuantity(material.quantity)}`)
    .join('; ');
}
