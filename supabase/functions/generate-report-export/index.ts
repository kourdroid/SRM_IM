import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 1000;
const MAX_ROWS = 100_000;
const OPEN_FOLLOW_UP_DAYS = 7;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
type SupabaseClient = ReturnType<typeof createClient>;

interface ExportRequest {
  startDate: string;
  endDate: string;
  communeId?: string;
  agentId?: string;
  type?: 'BT' | 'MT';
  status?: 'open' | 'closed';
  reclamation?: boolean;
}

interface FilterLabels {
  commune: string;
  agent: string;
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

    const filterLabels = await loadFilterLabels(admin, body);
    const workbook = buildWorkbook(body, incidentRows, filterLabels);
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
  equipment_used: string;
  description: string;
  reclamation_name: string;
  reclamation_by: string;
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

async function loadFilterLabels(admin: SupabaseClient, filters: ExportRequest): Promise<FilterLabels> {
  const [commune, agent] = await Promise.all([
    filters.communeId ? loadSingleName(admin, 'communes', filters.communeId) : Promise.resolve(null),
    filters.agentId ? loadSingleName(admin, 'user_profiles', filters.agentId) : Promise.resolve(null),
  ]);

  return {
    commune: commune || filters.communeId || 'Toutes',
    agent: agent || filters.agentId || 'Tous',
  };
}

async function loadSingleName(admin: SupabaseClient, table: 'communes' | 'user_profiles', id: string): Promise<string | null> {
  const { data, error } = await admin
    .from(table)
    .select('name')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return asString(asRecord(data).name) || null;
}

function buildWorkbook(filters: ExportRequest, rows: ReportRow[], filterLabels: FilterLabels): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const summary = buildSummary(rows);

  appendJsonSheet(workbook, 'Résumé', [
    { indicateur: 'Période', valeur: `${filters.startDate} au ${filters.endDate}` },
    { indicateur: 'Filtre commune', valeur: filterLabels.commune },
    { indicateur: 'Filtre agent', valeur: filterLabels.agent },
    { indicateur: 'Filtre réseau', valeur: filters.type || 'BT et MT' },
    { indicateur: 'Filtre statut', valeur: statusFilterLabel(filters.status) },
    { indicateur: 'Filtre réclamation', valeur: reclamationFilterLabel(filters.reclamation) },
    { indicateur: 'Total incidents', valeur: summary.total },
    { indicateur: 'Ouverts', valeur: summary.open },
    { indicateur: 'Clôturés', valeur: summary.closed },
    { indicateur: 'Réclamations', valeur: summary.reclamations },
    { indicateur: 'Durée moyenne clôture (heures)', valeur: summary.avgClosureHours },
  ]);

  appendJsonSheet(workbook, 'Incidents', rows.map((row) => ({
    'ID incident': row.id,
    'Réseau': row.type || 'Non renseigné',
    'Statut': statusLabel(row.status),
    'Commune': communeLabel(row),
    'Quartier / village': row.village || 'Non renseigné',
    "Type d'incident": incidentTypeLabel(row),
    'Départ HTA': departHtaLabel(row),
    'Agent': agentLabel(row),
    'Date création': formatDateTime(row.created_at),
    'Date clôture': formatDateTime(row.closed_at),
    'Durée clôture (heures)': row.closure_duration_hours,
    'Durée clôture (jours)': row.closure_duration_hours === null ? null : round(row.closure_duration_hours / 24),
    'Réclamation': yesNo(row.reclamation),
    'Réclamant': row.reclamation_name || '',
    'Réclamation par': row.reclamation_by || '',
    'Matériel utilisé': materialsLabel(row),
    'GPS disponible': yesNo(hasGps(row)),
    'Photos disponibles': yesNo(hasPhotos(row)),
    'Description': row.description,
  })));

  appendJsonSheet(workbook, 'Suivi opérationnel', buildOperationalFollowUp(rows));
  appendJsonSheet(workbook, 'Matériels détail', buildMaterialDetailRows(rows));
  appendJsonSheet(workbook, 'Matériels totaux', sumMaterials(rows));
  appendJsonSheet(workbook, 'Synthèses', buildSynthesisRows(rows));

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
    equipment_used: asString(row.equipment_used),
    description: asString(row.description),
    reclamation_name: asString(row.reclamation_name),
    reclamation_by: asString(row.reclamation_by),
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

function buildOperationalFollowUp(rows: ReportRow[]): Record<string, unknown>[] {
  const now = new Date();
  const followUpRows: Record<string, unknown>[] = [];

  rows.forEach((row) => {
    const base = {
      'ID incident': row.id,
      'Date création': formatDateTime(row.created_at),
      'Commune': communeLabel(row),
      'Agent': agentLabel(row),
      'Réseau': row.type || 'Non renseigné',
      'Statut': statusLabel(row.status),
      'Âge (jours)': incidentAgeDays(row, now),
    };

    if (!hasGps(row)) {
      followUpRows.push({ ...base, 'Problème': 'GPS manquant', 'Détail': 'Latitude et longitude absentes.' });
    }
    if (!hasPhotos(row)) {
      followUpRows.push({ ...base, 'Problème': 'Photo manquante', 'Détail': 'Aucune photo associée à l’incident.' });
    }
    if (row.type === 'MT' && !row.depart_hta) {
      followUpRows.push({ ...base, 'Problème': 'Départ HTA manquant', 'Détail': 'Incident MT sans départ HTA renseigné.' });
    }
    if (row.status === 'closed' && (!row.closed_at || row.closure_duration_hours === null)) {
      followUpRows.push({ ...base, 'Problème': 'Clôture incomplète', 'Détail': 'Incident clôturé sans date ou durée de clôture.' });
    }
    if (row.status !== 'closed' && incidentAgeDays(row, now) >= OPEN_FOLLOW_UP_DAYS) {
      followUpRows.push({
        ...base,
        'Problème': `Incident ouvert depuis ${OPEN_FOLLOW_UP_DAYS} jours ou plus`,
        'Détail': 'Incident encore en cours après le seuil de suivi.',
      });
    }
  });

  return followUpRows;
}

function buildMaterialDetailRows(rows: ReportRow[]): Record<string, unknown>[] {
  return rows.flatMap((row) =>
    row.materials.map((material) => ({
      'ID incident': row.id,
      'Date incident': formatDateTime(row.created_at),
      'Commune': communeLabel(row),
      'Agent': agentLabel(row),
      'Réseau': row.type || 'Non renseigné',
      "Type d'incident": incidentTypeLabel(row),
      'Matériel': material.material_name,
      'Quantité': round(material.quantity),
    }))
  );
}

function buildSynthesisRows(rows: ReportRow[]): Record<string, unknown>[] {
  return [
    ...countBy(rows, row => communeLabel(row), 'Commune'),
    ...countBy(rows, row => agentLabel(row), 'Agent'),
    ...countBy(rows, row => `${row.type || 'Non renseigné'} - ${incidentTypeLabel(row)}`, "Type d'incident"),
    ...countBy(rows.filter(row => row.type === 'MT'), row => departHtaLabel(row), 'Départ HTA'),
    ...countBy(rows, row => statusLabel(row.status), 'Statut'),
    ...countBy(rows, row => yesNo(row.reclamation), 'Réclamation'),
  ];
}

function countBy(rows: ReportRow[], getLabel: (row: ReportRow) => string, category: string): Record<string, unknown>[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = getLabel(row);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([libelle, incidents]) => ({ catégorie: category, libellé: libelle, incidents }))
    .sort((left, right) => Number(right.incidents) - Number(left.incidents) || String(left.libellé).localeCompare(String(right.libellé)));
}

function sumMaterials(rows: ReportRow[]): Record<string, unknown>[] {
  const sums = new Map<string, number>();
  rows.forEach((row) => {
    row.materials.forEach((material) => {
      sums.set(material.material_name, (sums.get(material.material_name) || 0) + material.quantity);
    });
  });
  return Array.from(sums.entries())
    .map(([materiel, quantite]) => ({ 'Matériel': materiel, 'Quantité totale': round(quantite) }))
    .sort((left, right) => Number(right['Quantité totale']) - Number(left['Quantité totale']) || String(left['Matériel']).localeCompare(String(right['Matériel'])));
}

function statusLabel(status: string): string {
  return status === 'closed' ? 'Clôturé' : 'En cours';
}

function statusFilterLabel(status?: 'open' | 'closed'): string {
  if (status === 'open') return 'En cours';
  if (status === 'closed') return 'Clôturé';
  return 'Tous';
}

function reclamationFilterLabel(reclamation?: boolean): string {
  if (reclamation === true) return 'Avec réclamation';
  if (reclamation === false) return 'Sans réclamation';
  return 'Toutes';
}

function yesNo(value: boolean): string {
  return value ? 'Oui' : 'Non';
}

function communeLabel(row: ReportRow): string {
  return row.commune_name || 'Commune inconnue';
}

function agentLabel(row: ReportRow): string {
  return row.agent_name || 'Agent inconnu';
}

function incidentTypeLabel(row: ReportRow): string {
  return row.incident_type || 'Non classé';
}

function departHtaLabel(row: ReportRow): string {
  return row.depart_hta || 'Non renseigné';
}

function materialsLabel(row: ReportRow): string {
  return row.materials_summary || row.equipment_used || 'Non renseigné';
}

function hasGps(row: ReportRow): boolean {
  return row.latitude !== null && row.longitude !== null;
}

function hasPhotos(row: ReportRow): boolean {
  return row.media_count > 0;
}

function incidentAgeDays(row: ReportRow, now: Date): number {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
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
