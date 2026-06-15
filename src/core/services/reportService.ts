import { supabase } from '@/lib/supabase';
import { formatMaterialsSummary } from '@/lib/materials';

export interface ReportFilters {
  startDate: string;
  endDate: string;
  communeId?: string;
  agentId?: string;
  type?: 'BT' | 'MT';
  status?: 'open' | 'closed';
  reclamation?: boolean;
}

export interface ReportSummary {
  total: number;
  open: number;
  closed: number;
  reclamations: number;
  bt: number;
  mt: number;
  missingGps: number;
  missingPhoto: number;
  avgClosureDays: number;
  maxClosureDays: number;
}

export interface ReportPoint {
  label: string;
  value: number;
}

export interface ReportBreakdowns {
  monthly: ReportPoint[];
  byCommune: ReportPoint[];
  byAgent: ReportPoint[];
  byIncidentType: ReportPoint[];
  byDepartHta: ReportPoint[];
  byMaterialQuantity: ReportPoint[];
}

export interface ReportRow {
  id: string;
  title: string | null;
  type: string;
  status: string;
  incident_type: string;
  depart_hta: string | null;
  commune_name: string | null;
  village: string;
  agent_name: string | null;
  equipment_used: string | null;
  reclamation: boolean;
  created_at: string;
  closed_at: string | null;
  closure_duration_hours: number | null;
  latitude: number | null;
  longitude: number | null;
  media_count: number;
  materials_summary: string | null;
  materials: ReportMaterial[];
}

interface DirectIncidentRow extends ReportRow {
  created_by: string | null;
  incident_materials?: unknown;
}

export interface ReportMaterial {
  material_name: string;
  quantity: number;
}

export interface IncidentReport {
  filters: ReportFilters;
  summary: ReportSummary;
  breakdowns: ReportBreakdowns;
  rows: ReportRow[];
  media: ReportMedia[];
  events: ReportEvent[];
}

export interface ReportOptions {
  includeAuditDetails?: boolean;
  includeRows?: boolean;
}

export interface ReportMedia {
  incident_id: string;
  public_url: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ReportEvent {
  incident_id: string;
  event_type: string;
  actor_id: string | null;
  source: string;
  created_at: string;
}

type RpcParams = {
  p_start_date: string;
  p_end_date: string;
  p_commune_id: string | null;
  p_agent_id: string | null;
  p_type: string | null;
  p_status: string | null;
  p_reclamation: boolean | null;
};

export const ReportService = {
  async getIncidentReport(filters: ReportFilters, options: ReportOptions = {}): Promise<IncidentReport> {
    const params = buildRpcParams(filters);

    const [{ data: summaryData, error: summaryError }, { data: breakdownData, error: breakdownError }, requestedRows] =
      await Promise.all([
        supabase.rpc('get_incident_report_summary', params),
        supabase.rpc('get_incident_report_breakdowns', params),
        options.includeRows || options.includeAuditDetails ? fetchAllRows(params) : Promise.resolve([]),
      ]);
    const rows = summaryError || breakdownError ? await fetchAllRows(params) : requestedRows;

    const summary = summaryError && isMissingReportingRpcError(summaryError)
      ? buildSummaryFromRows(rows)
      : parseSummary(summaryData);
    const breakdowns = breakdownError && isMissingReportingRpcError(breakdownError)
      ? buildBreakdownsFromRows(rows)
      : parseBreakdowns(breakdownData);

    if (summaryError && !isMissingReportingRpcError(summaryError)) {
      throw new Error(`Report summary failed: ${summaryError.message}`);
    }
    if (breakdownError && !isMissingReportingRpcError(breakdownError)) {
      throw new Error(`Report breakdown failed: ${breakdownError.message}`);
    }

    const incidentIds = options.includeAuditDetails ? rows.map(row => row.id) : [];
    const [media, events] = options.includeAuditDetails
      ? await Promise.all([
        fetchReportMedia(incidentIds),
        fetchReportEvents(incidentIds),
      ])
      : [[], []];

    return {
      filters,
      summary,
      breakdowns,
      rows,
      media,
      events,
    };
  },

  async exportServerXlsx(filters: ReportFilters): Promise<string> {
    const { data, error } = await supabase.functions.invoke('generate-report-export', {
      body: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        communeId: filters.communeId,
        agentId: filters.agentId,
        type: filters.type,
        status: filters.status,
        reclamation: filters.reclamation,
      },
    });

    if (error) {
      throw new Error(`Server export failed: ${error.message}`);
    }
    const record = asRecord(data);
    const downloadUrl = asString(record.downloadUrl);
    if (!downloadUrl) {
      throw new Error('Server export returned no download URL.');
    }
    return downloadUrl;
  },
};

async function fetchAllRows(params: RpcParams): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.rpc('get_incident_report_rows', {
      ...params,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) {
      if (isMissingReportingRpcError(error)) {
        return fetchAllRowsFromTables(params);
      }
      throw new Error(`Report rows failed: ${error.message}`);
    }

    const page = Array.isArray(data) ? data.map(parseRow) : [];
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return rows;
}

async function fetchAllRowsFromTables(params: RpcParams): Promise<ReportRow[]> {
  const rows: DirectIncidentRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('incidents')
      .select(`
        id,
        title,
        type,
        status,
        incident_type,
        depart_hta,
        village,
        equipment_used,
        reclamation,
        created_at,
        closed_at,
        latitude,
        longitude,
        media_urls,
        incident_materials(material_name, quantity),
        created_by,
        communes(name)
      `)
      .gte('created_at', params.p_start_date)
      .lt('created_at', params.p_end_date)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (params.p_commune_id) {
      query = query.eq('commune_id', params.p_commune_id);
    }
    if (params.p_agent_id) {
      query = query.eq('created_by', params.p_agent_id);
    }
    if (params.p_type) {
      query = query.eq('type', params.p_type);
    }
    if (params.p_status) {
      query = query.eq('status', params.p_status);
    }
    if (params.p_reclamation !== null) {
      query = query.eq('reclamation', params.p_reclamation);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Report rows fallback failed: ${error.message}`);
    }

    const page = Array.isArray(data) ? data.map(parseDirectIncidentRow) : [];
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  const profileMap = await fetchProfileNames(rows.map(row => row.created_by).filter(isString));
  return rows.map(row => ({
    ...row,
    agent_name: row.created_by ? profileMap.get(row.created_by) ?? row.agent_name : row.agent_name,
  }));
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(`Report profiles failed: ${error.message}`);
  }

  return new Map((Array.isArray(data) ? data : []).map((item) => {
    const record = asRecord(item);
    return [asString(record.id), asString(record.name)] as const;
  }));
}

async function fetchReportMedia(incidentIds: string[]): Promise<ReportMedia[]> {
  const rows: ReportMedia[] = [];
  for (const chunk of chunkArray(incidentIds, 200)) {
    const { data, error } = await supabase
      .from('incident_media')
      .select('incident_id, public_url, storage_path, uploaded_by, created_at')
      .in('incident_id', chunk)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return rows;
      }
      throw new Error(`Report media failed: ${error.message}`);
    }

    rows.push(...(Array.isArray(data) ? data.map(parseMedia) : []));
  }
  return rows;
}

async function fetchReportEvents(incidentIds: string[]): Promise<ReportEvent[]> {
  const rows: ReportEvent[] = [];
  for (const chunk of chunkArray(incidentIds, 200)) {
    const { data, error } = await supabase
      .from('incident_events')
      .select('incident_id, event_type, actor_id, source, created_at')
      .in('incident_id', chunk)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return rows;
      }
      throw new Error(`Report events failed: ${error.message}`);
    }

    rows.push(...(Array.isArray(data) ? data.map(parseEvent) : []));
  }
  return rows;
}

function buildRpcParams(filters: ReportFilters): RpcParams {
  const end = new Date(`${filters.endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    p_start_date: new Date(`${filters.startDate}T00:00:00.000Z`).toISOString(),
    p_end_date: end.toISOString(),
    p_commune_id: filters.communeId || null,
    p_agent_id: filters.agentId || null,
    p_type: filters.type || null,
    p_status: filters.status || null,
    p_reclamation: filters.reclamation ?? null,
  };
}

function buildSummaryFromRows(rows: ReportRow[]): ReportSummary {
  const closureDurations = rows
    .map(row => row.closure_duration_hours === null ? null : row.closure_duration_hours / 24)
    .filter((value): value is number => value !== null)
    .filter(Number.isFinite);

  return {
    total: rows.length,
    open: rows.filter(row => row.status === 'open').length,
    closed: rows.filter(row => row.status === 'closed').length,
    reclamations: rows.filter(row => row.reclamation).length,
    bt: rows.filter(row => row.type === 'BT').length,
    mt: rows.filter(row => row.type === 'MT').length,
    missingGps: rows.filter(row => row.latitude === null || row.longitude === null).length,
    missingPhoto: rows.filter(row => row.media_count === 0).length,
    avgClosureDays: closureDurations.length === 0
      ? 0
      : closureDurations.reduce((sum, value) => sum + value, 0) / closureDurations.length,
    maxClosureDays: closureDurations.length === 0 ? 0 : Math.max(...closureDurations),
  };
}

function buildBreakdownsFromRows(rows: ReportRow[]): ReportBreakdowns {
  return {
    monthly: countBy(rows, row => row.created_at.slice(0, 7), 100, 'asc'),
    byCommune: countBy(rows, row => row.commune_name || 'Commune inconnue', 20, 'desc'),
    byAgent: countBy(rows, row => row.agent_name || 'Agent inconnu', 20, 'desc'),
    byIncidentType: countBy(rows, row => row.incident_type || 'Non classé', 20, 'desc'),
    byDepartHta: countBy(rows.filter(row => row.type === 'MT'), row => row.depart_hta || 'Non renseigné', 20, 'desc'),
    byMaterialQuantity: sumMaterials(rows, 20),
  };
}

function countBy(
  rows: ReportRow[],
  getLabel: (row: ReportRow) => string,
  limit: number,
  direction: 'asc' | 'desc',
): ReportPoint[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = getLabel(row);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => {
      if (direction === 'asc') {
        return left.label.localeCompare(right.label);
      }
      return right.value - left.value || left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

function parseSummary(value: unknown): ReportSummary {
  const record = asRecord(value);
  return {
    total: asNumber(record.total),
    open: asNumber(record.open),
    closed: asNumber(record.closed),
    reclamations: asNumber(record.reclamations),
    bt: asNumber(record.bt),
    mt: asNumber(record.mt),
    missingGps: asNumber(record.missingGps),
    missingPhoto: asNumber(record.missingPhoto),
    avgClosureDays: asNumber(record.avgClosureDays),
    maxClosureDays: asNumber(record.maxClosureDays),
  };
}

function parseBreakdowns(value: unknown): ReportBreakdowns {
  const record = asRecord(value);
  return {
    monthly: asPointArray(record.monthly),
    byCommune: asPointArray(record.byCommune),
    byAgent: asPointArray(record.byAgent),
    byIncidentType: asPointArray(record.byIncidentType),
    byDepartHta: asPointArray(record.byDepartHta),
    byMaterialQuantity: asPointArray(record.byMaterialQuantity),
  };
}

function parseRow(value: unknown): ReportRow {
  const row = asRecord(value);
  const materials = parseMaterials(row.materials);
  const equipmentUsed = asNullableString(row.equipment_used);
  return {
    id: asString(row.id),
    title: asNullableString(row.title),
    type: asString(row.type),
    status: asString(row.status),
    incident_type: asString(row.incident_type),
    depart_hta: asNullableString(row.depart_hta),
    commune_name: asNullableString(row.commune_name),
    village: asString(row.village),
    agent_name: asNullableString(row.agent_name),
    equipment_used: equipmentUsed,
    reclamation: row.reclamation === true,
    created_at: asString(row.created_at),
    closed_at: asNullableString(row.closed_at),
    closure_duration_hours: asNullableNumber(row.closure_duration_hours),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    media_count: asNumber(row.media_count),
    materials_summary: asNullableString(row.materials_summary) || formatMaterialsSummary(materials, equipmentUsed || ''),
    materials,
  };
}

function parseDirectIncidentRow(value: unknown): DirectIncidentRow {
  const row = asRecord(value);
  const commune = asRecord(row.communes);
  const createdAt = asString(row.created_at);
  const closedAt = asNullableString(row.closed_at);
  const materials = parseMaterials(row.incident_materials);
  const equipmentUsed = asNullableString(row.equipment_used);
  return {
    id: asString(row.id),
    title: asNullableString(row.title),
    type: asString(row.type),
    status: asString(row.status),
    incident_type: asString(row.incident_type),
    depart_hta: asNullableString(row.depart_hta),
    commune_name: asNullableString(commune.name),
    village: asString(row.village),
    agent_name: null,
    equipment_used: equipmentUsed,
    reclamation: row.reclamation === true,
    created_at: createdAt,
    closed_at: closedAt,
    closure_duration_hours: calculateClosureHours(createdAt, closedAt),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    media_count: asArrayLength(row.media_urls),
    materials_summary: formatMaterialsSummary(materials, equipmentUsed || ''),
    materials,
    created_by: asNullableString(row.created_by),
  };
}

function parseMedia(value: unknown): ReportMedia {
  const row = asRecord(value);
  return {
    incident_id: asString(row.incident_id),
    public_url: asString(row.public_url),
    storage_path: asString(row.storage_path),
    uploaded_by: asNullableString(row.uploaded_by),
    created_at: asString(row.created_at),
  };
}

function parseEvent(value: unknown): ReportEvent {
  const row = asRecord(value);
  return {
    incident_id: asString(row.incident_id),
    event_type: asString(row.event_type),
    actor_id: asNullableString(row.actor_id),
    source: asString(row.source),
    created_at: asString(row.created_at),
  };
}

function asPointArray(value: unknown): ReportPoint[] {
  return Array.isArray(value) ? value.map((item) => {
    const record = asRecord(item);
    return { label: asString(record.label), value: asNumber(record.value) };
  }) : [];
}

function parseMaterials(value: unknown): ReportMaterial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const materialName = asString(record.material_name);
    const quantity = asNumber(record.quantity);
    return materialName && quantity > 0 ? [{ material_name: materialName, quantity }] : [];
  });
}

function sumMaterials(rows: ReportRow[], limit: number): ReportPoint[] {
  const sums = new Map<string, number>();
  rows.forEach((row) => {
    row.materials.forEach((material) => {
      sums.set(material.material_name, (sums.get(material.material_name) || 0) + material.quantity);
    });
  });

  return Array.from(sums.entries())
    .map(([label, value]) => ({ label, value: Math.round(value * 1000) / 1000 }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value);
}

function asArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value || '');
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : asString(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isMissingReportingRpcError(error: { code?: string; message: string }): boolean {
  const message = error.message.toLowerCase();
  return error.code === 'PGRST202' || (
    message.includes('schema cache') &&
    message.includes('get_incident_report_')
  );
}

function isMissingRelationError(error: { code?: string; message: string }): boolean {
  const message = error.message.toLowerCase();
  return error.code === '42P01' || (
    message.includes('schema cache') &&
    (message.includes('incident_media') || message.includes('incident_events'))
  );
}

function calculateClosureHours(createdAt: string, closedAt: string | null): number | null {
  if (!closedAt) return null;
  const created = new Date(createdAt).getTime();
  const closed = new Date(closedAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(closed)) return null;
  return Math.max(0, Math.round(((closed - created) / 3600000) * 100) / 100);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
