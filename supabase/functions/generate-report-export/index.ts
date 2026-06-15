import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 1000;
const MAX_ROWS = 100_000;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface ExportRequest {
  startDate: string;
  endDate: string;
  communeId?: string;
  agentId?: string;
  type?: 'BT' | 'MT';
  status?: 'open' | 'closed';
  reclamation?: boolean;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !authorization) {
    return json({ error: 'Server configuration or authorization missing' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userScoped = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return json({ error: 'Invalid session' }, 401);
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return json({ error: 'Admin role required' }, 403);
  }

  const body = await request.json() as ExportRequest;
  if (!isIsoDate(body.startDate) || !isIsoDate(body.endDate) || body.endDate < body.startDate) {
    return json({ error: 'Invalid date range' }, 400);
  }
  if (body.type !== undefined && body.type !== 'BT' && body.type !== 'MT') {
    return json({ error: 'Invalid incident type filter' }, 400);
  }
  if (body.status !== undefined && body.status !== 'open' && body.status !== 'closed') {
    return json({ error: 'Invalid status filter' }, 400);
  }

  const { data: job, error: jobError } = await admin
    .from('report_exports')
    .insert({
      requested_by: userId,
      start_date: body.startDate,
      end_date: body.endDate,
      format: 'xlsx',
      filters: {
        communeId: body.communeId,
        agentId: body.agentId,
        type: body.type,
        status: body.status,
        reclamation: body.reclamation,
      },
      status: 'running',
    })
    .select('id')
    .single();
  if (jobError || !job) {
    return json({ error: jobError?.message || 'Could not create export job' }, 500);
  }

  try {
    const incidentRows: ReportRow[] = [];
    let offset = 0;
    let exportComplete = false;
    const endExclusive = new Date(`${body.endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    while (offset < MAX_ROWS) {
      const { data, error } = await userScoped.rpc('get_incident_report_rows', {
        p_start_date: `${body.startDate}T00:00:00.000Z`,
        p_end_date: endExclusive.toISOString(),
        p_commune_id: body.communeId ?? null,
        p_agent_id: body.agentId ?? null,
        p_type: body.type ?? null,
        p_status: body.status ?? null,
        p_reclamation: body.reclamation ?? null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        incidentRows.push(parseReportRow(row));
      }
      offset += rows.length;
      if (rows.length < PAGE_SIZE) {
        exportComplete = true;
        break;
      }
    }

    if (!exportComplete) {
      throw new Error(`Export exceeds the ${MAX_ROWS} row safety limit. Reduce the date range.`);
    }

    const workbook = buildWorkbook(body, incidentRows);
    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const storagePath = `${userId}/${job.id}.xlsx`;
    const { error: uploadError } = await admin.storage
      .from('report-exports')
      .upload(storagePath, new Blob([workbookBytes], { type: XLSX_MIME }), {
        upsert: true,
        contentType: XLSX_MIME,
      });
    if (uploadError) throw uploadError;

    await admin.from('report_exports').update({
      status: 'done',
      storage_path: storagePath,
      row_count: incidentRows.length,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    const { data: signed, error: signedError } = await admin.storage
      .from('report-exports')
      .createSignedUrl(storagePath, 3600);
    if (signedError) throw signedError;

    return json({ id: job.id, rowCount: incidentRows.length, format: 'xlsx', downloadUrl: signed.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    await admin.from('report_exports').update({
      status: 'failed',
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    return json({ error: message, id: job.id }, 500);
  }
});

interface ReportRow {
  id: string;
  title: string;
  type: string;
  status: string;
  incident_type: string;
  depart_hta: string;
  commune_name: string;
  village: string;
  agent_name: string;
  created_at: string;
  closed_at: string;
  closure_duration_hours: number | null;
  latitude: number | null;
  longitude: number | null;
  media_count: number;
  materials_summary: string;
  materials: ReportMaterial[];
  reclamation: boolean;
}

interface ReportMaterial {
  material_name: string;
  quantity: number;
}

function buildWorkbook(filters: ExportRequest, rows: ReportRow[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const summary = buildSummary(rows);

  appendJsonSheet(workbook, 'Résumé', [
    { indicateur: 'Date début', valeur: filters.startDate },
    { indicateur: 'Date fin', valeur: filters.endDate },
    { indicateur: 'Filtre commune', valeur: filters.communeId || 'Toutes' },
    { indicateur: 'Filtre agent', valeur: filters.agentId || 'Tous' },
    { indicateur: 'Filtre réseau', valeur: filters.type || 'BT et MT' },
    { indicateur: 'Filtre statut', valeur: filters.status || 'Tous' },
    { indicateur: 'Total incidents', valeur: summary.total },
    { indicateur: 'Ouverts', valeur: summary.open },
    { indicateur: 'Clôturés', valeur: summary.closed },
    { indicateur: 'Réclamations', valeur: summary.reclamations },
    { indicateur: 'Durée moyenne clôture (heures)', valeur: summary.avgClosureHours },
  ]);

  appendJsonSheet(workbook, 'Incidents', rows.map((row) => ({
    id: row.id,
    titre: row.title,
    reseau: row.type,
    statut: row.status,
    type_incident: row.incident_type,
    depart_hta: row.depart_hta,
    commune: row.commune_name,
    quartier_village: row.village,
    agent: row.agent_name,
    cree_le: formatDateTime(row.created_at),
    cloture_le: formatDateTime(row.closed_at),
    duree_cloture_heures: row.closure_duration_hours,
    duree_cloture_jours: row.closure_duration_hours === null ? null : round(row.closure_duration_hours / 24),
    latitude: row.latitude,
    longitude: row.longitude,
    nombre_photos: row.media_count,
    reclamation: row.reclamation ? 'Oui' : 'Non',
    materiels: row.materials_summary,
  })));

  appendJsonSheet(workbook, 'Matériels', sumMaterials(rows));
  appendJsonSheet(workbook, 'Départs HTA', countBy(rows.filter(row => row.type === 'MT'), row => row.depart_hta || 'Non renseigné'));
  appendJsonSheet(workbook, 'Types incidents', countBy(rows, row => `${row.type} - ${row.incident_type || 'Non classé'}`));

  return workbook;
}

function appendJsonSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]): void {
  const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ vide: 'Aucune donnée' }]);
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const widths: { wch: number }[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    let max = 12;
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const value = cell?.v === null || cell?.v === undefined ? '' : String(cell.v);
      max = Math.min(42, Math.max(max, value.length + 2));
    }
    widths.push({ wch: max });
  }
  sheet['!cols'] = widths;
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function parseReportRow(value: unknown): ReportRow {
  const row = asRecord(value);
  const materials = parseMaterials(row.materials);
  return {
    id: asString(row.id),
    title: asString(row.title),
    type: asString(row.type),
    status: asString(row.status),
    incident_type: asString(row.incident_type),
    depart_hta: asString(row.depart_hta),
    commune_name: asString(row.commune_name),
    village: asString(row.village),
    agent_name: asString(row.agent_name),
    created_at: asString(row.created_at),
    closed_at: asString(row.closed_at),
    closure_duration_hours: asNullableNumber(row.closure_duration_hours),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    media_count: asNumber(row.media_count),
    materials_summary: asString(row.materials_summary) || formatMaterialsSummary(materials),
    materials,
    reclamation: row.reclamation === true,
  };
}

function buildSummary(rows: ReportRow[]) {
  const closureDurations = rows
    .map(row => row.closure_duration_hours)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    total: rows.length,
    open: rows.filter(row => row.status === 'open').length,
    closed: rows.filter(row => row.status === 'closed').length,
    reclamations: rows.filter(row => row.reclamation).length,
    avgClosureHours: closureDurations.length === 0
      ? 0
      : round(closureDurations.reduce((sum, value) => sum + value, 0) / closureDurations.length),
  };
}

function countBy(rows: ReportRow[], getLabel: (row: ReportRow) => string): Record<string, unknown>[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = getLabel(row);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([libelle, incidents]) => ({ libelle, incidents }))
    .sort((left, right) => Number(right.incidents) - Number(left.incidents) || String(left.libelle).localeCompare(String(right.libelle)));
}

function sumMaterials(rows: ReportRow[]): Record<string, unknown>[] {
  const sums = new Map<string, number>();
  rows.forEach((row) => {
    row.materials.forEach((material) => {
      sums.set(material.material_name, (sums.get(material.material_name) || 0) + material.quantity);
    });
  });
  return Array.from(sums.entries())
    .map(([materiel, quantite]) => ({ materiel, quantite: round(quantite) }))
    .sort((left, right) => Number(right.quantite) - Number(left.quantite) || String(left.materiel).localeCompare(String(right.materiel)));
}

function parseMaterials(value: unknown): ReportMaterial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const materialName = asString(row.material_name);
    const quantity = asNumber(row.quantity);
    return materialName && quantity > 0 ? [{ material_name: materialName, quantity }] : [];
  });
}

function formatMaterialsSummary(materials: ReportMaterial[]): string {
  return materials.map(material => `${material.material_name} x${round(material.quantity)}`).join('; ');
}

function formatDateTime(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('T', ' ').slice(0, 16);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function asString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
