import { supabase } from '@/lib/supabase';

export interface DirectorDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  reclamations: number;
  avgClosureDays: number;
  longestOpenHours: number;
}

export interface DirectorIncident {
  id: string;
  title?: string;
  type: 'BT' | 'MT';
  date: string;
  village: string;
  status: 'open' | 'closed';
  incident_type: string;
  commune_id: string | null;
  commune_name: string | null;
  equipment_used: string;
  description: string;
  reclamation: boolean;
  reclamation_name?: string;
  reclamation_by?: string;
  created_by: string | null;
  created_by_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  media_urls: string[];
}

export interface DirectorIncidentFilters {
  status?: 'open' | 'closed' | 'all';
  type?: 'BT' | 'MT' | 'all';
  search?: string;
  lastCreatedAt?: string;
}

type DirectorDashboardRecord = {
  total?: unknown;
  open?: unknown;
  closed?: unknown;
  reclamations?: unknown;
  avgClosureDays?: unknown;
  longestOpenHours?: unknown;
};

type DirectorIncidentRecord = {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  date?: unknown;
  village?: unknown;
  status?: unknown;
  incident_type?: unknown;
  commune_id?: unknown;
  commune_name?: unknown;
  equipment_used?: unknown;
  description?: unknown;
  reclamation?: unknown;
  reclamation_name?: unknown;
  reclamation_by?: unknown;
  created_by?: unknown;
  created_by_name?: unknown;
  closed_by?: unknown;
  closed_by_name?: unknown;
  closed_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  media_urls?: unknown;
};

export const DirectorService = {
  async getDashboardMetrics(): Promise<DirectorDashboardMetrics> {
    const { data, error } = await supabase.rpc('get_director_dashboard_metrics');
    if (error) throw new Error(`Director dashboard failed: ${error.message}`);
    return parseDashboardMetrics(data);
  },

  async getLatestOpenIncidents(limit = 5): Promise<DirectorIncident[]> {
    return this.getIncidents(limit, { status: 'open' });
  },

  async getIncidents(limit = 20, filters: DirectorIncidentFilters = {}): Promise<DirectorIncident[]> {
    const { data, error } = await supabase.rpc('get_director_incidents', {
      p_limit: limit,
      p_before_created_at: filters.lastCreatedAt || null,
      p_status: filters.status && filters.status !== 'all' ? filters.status : null,
      p_type: filters.type && filters.type !== 'all' ? filters.type : null,
      p_search: filters.search?.trim() || null,
    });

    if (error) throw new Error(`Director incidents failed: ${error.message}`);
    return (Array.isArray(data) ? data : []).map(parseIncident);
  },
};

function parseDashboardMetrics(value: unknown): DirectorDashboardMetrics {
  const record = asRecord(value) as DirectorDashboardRecord;
  return {
    total: asNumber(record.total),
    open: asNumber(record.open),
    closed: asNumber(record.closed),
    reclamations: asNumber(record.reclamations),
    avgClosureDays: asNumber(record.avgClosureDays),
    longestOpenHours: asNumber(record.longestOpenHours),
  };
}

function parseIncident(value: unknown): DirectorIncident {
  const record = asRecord(value) as DirectorIncidentRecord;
  return {
    id: asString(record.id),
    title: asOptionalString(record.title),
    type: record.type === 'MT' ? 'MT' : 'BT',
    date: asString(record.date),
    village: asString(record.village),
    status: record.status === 'closed' ? 'closed' : 'open',
    incident_type: asString(record.incident_type),
    commune_id: asNullableString(record.commune_id),
    commune_name: asNullableString(record.commune_name),
    equipment_used: asString(record.equipment_used),
    description: asString(record.description),
    reclamation: record.reclamation === true,
    reclamation_name: asOptionalString(record.reclamation_name),
    reclamation_by: asOptionalString(record.reclamation_by),
    created_by: asNullableString(record.created_by),
    created_by_name: asNullableString(record.created_by_name),
    closed_by: asNullableString(record.closed_by),
    closed_by_name: asNullableString(record.closed_by_name),
    closed_at: asNullableString(record.closed_at),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
    latitude: asNullableNumber(record.latitude),
    longitude: asNullableNumber(record.longitude),
    media_urls: parseMediaUrls(record.media_urls),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value || '');
}

function asOptionalString(value: unknown): string | undefined {
  const text = asString(value);
  return text.length > 0 ? text : undefined;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = asString(value);
  return text.length > 0 ? text : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseMediaUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
}
