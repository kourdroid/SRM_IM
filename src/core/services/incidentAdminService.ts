import { supabase } from '@/lib/supabase';
import { buildEquipmentSummary, formatMaterialsSummary, type IncidentMaterialInput } from '@/lib/materials';
import * as Network from 'expo-network';
import {
    AdminIncidentClosureSchema,
    AdminIncidentUpdateSchema,
    type AdminIncidentClosure,
    type AdminIncidentUpdate,
} from '../entities/admin';

export interface Incident {
    id: string;
    remote_id?: string;
    title?: string;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    status: 'open' | 'closed';
    incident_type: string;
    depart_hta?: string | null;
    commune_id: string;
    commune_name?: string;
    equipment_used: string;
    description: string;
    reclamation: boolean;
    reclamation_name?: string;
    reclamation_by?: string;
    created_by: string;
    created_by_name?: string;
    closed_by?: string | null;
    closed_by_name?: string | null;
    closed_at?: string | null;
    created_at: string;
    updated_at: string;
    latitude?: number | null;
    longitude?: number | null;
    media_urls?: string[];
    materials?: IncidentMaterialSummary[];
    materials_summary?: string;
}

export interface IncidentMaterialSummary {
    material_name: string;
    quantity: number;
}

export interface IncidentFilters {
    status?: 'open' | 'closed' | 'all';
    type?: 'BT' | 'MT' | 'all';
    communeId?: string;
    reclamation?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
    agentId?: string;
    hasGps?: boolean;
    hasMedia?: boolean;
}

type IncidentListRecord = {
    id: string;
    title: string | null;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    status: 'open' | 'closed';
    incident_type: string;
    depart_hta: string | null;
    commune_id: string;
    communes?: { name: string | null } | { name: string | null }[] | null;
    equipment_used: string | null;
    description: string | null;
    reclamation: boolean | number | null;
    reclamation_name: string | null;
    reclamation_by: string | null;
    created_by: string;
    closed_by: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
    latitude: number | null;
    longitude: number | null;
    media_urls: unknown;
    incident_materials?: unknown;
};

const INCIDENT_LIST_COLUMNS = `
    id,
    title,
    type,
    date,
    village,
    status,
    incident_type,
    depart_hta,
    commune_id,
    equipment_used,
    description,
    reclamation,
    reclamation_name,
    reclamation_by,
    created_by,
    closed_by,
    closed_at,
    created_at,
    updated_at,
    latitude,
    longitude,
    media_urls,
    incident_materials(material_name, quantity),
    communes(name)
`;

export const IncidentAdminService = {
    /**
     * Cursor-based fetching for infinite scrolling, supporting advanced filtering and search.
     */
    async getIncidents(limit = 20, lastCreatedAt?: string, filters?: IncidentFilters): Promise<Incident[]> {
        let query = supabase
            .from('incidents')
            .select(INCIDENT_LIST_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (lastCreatedAt) {
            query = query.lt('created_at', lastCreatedAt);
        }

        if (filters) {
            if (filters.status && filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }
            if (filters.type && filters.type !== 'all') {
                query = query.eq('type', filters.type);
            }
            if (filters.communeId && filters.communeId !== 'all' && filters.communeId !== '') {
                query = query.eq('commune_id', filters.communeId);
            }
            if (filters.reclamation !== undefined) {
                query = query.eq('reclamation', filters.reclamation);
            }
            if (filters.agentId && filters.agentId !== 'all') {
                query = query.eq('created_by', filters.agentId);
            }
            if (filters.hasGps === true) {
                query = query.not('latitude', 'is', null).not('longitude', 'is', null);
            } else if (filters.hasGps === false) {
                query = query.or('latitude.is.null,longitude.is.null');
            }
            if (filters.hasMedia === true) {
                query = query.not('media_urls', 'eq', '{}');
            } else if (filters.hasMedia === false) {
                query = query.or('media_urls.is.null,media_urls.eq.{}');
            }
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                // Add 1 day to end date to make it inclusive of the end day
                const end = new Date(filters.endDate);
                end.setDate(end.getDate() + 1);
                query = query.lt('created_at', end.toISOString().split('T')[0]);
            }
            if (filters.search && filters.search.trim() !== '') {
                const search = filters.search.trim();
                // Prevent PostgREST query injection by escaping double quotes and wrapping the entire string with wildcards
                const safeSearch = search.replace(/"/g, '""');
                query = query.or(`description.ilike."%${safeSearch}%",village.ilike."%${safeSearch}%",depart_hta.ilike."%${safeSearch}%"`);
            }
        }

        const { data, error } = await query;
        if (error) throw new Error(`Fetch incidents failed: ${error.message}`);

        const incidents = (data || []) as unknown as IncidentListRecord[];

        // Map commune name and profiles
        if (incidents.length > 0) {
            const userIds = Array.from(new Set(
                incidents.flatMap(i => [i.created_by, i.closed_by]).filter(Boolean)
            ));
            let profileMap = new Map<string, string>();
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, name')
                    .in('id', userIds);
                
                if (profiles) {
                    profileMap = new Map(profiles.map(p => [p.id, p.name]));
                }
            }

            return incidents.map(item => ({
                id: item.id,
                title: item.title || undefined,
                type: item.type,
                date: item.date,
                village: item.village,
                status: item.status,
                incident_type: item.incident_type,
                depart_hta: item.depart_hta || null,
                commune_id: item.commune_id,
                commune_name: getEmbeddedCommuneName(item.communes),
                equipment_used: item.equipment_used || '',
                description: item.description || '',
                reclamation: item.reclamation === true || item.reclamation === 1,
                reclamation_name: item.reclamation_name || undefined,
                reclamation_by: item.reclamation_by || undefined,
                created_by: item.created_by,
                created_by_name: profileMap.get(item.created_by) || 'Anonymous User',
                closed_by: item.closed_by,
                closed_by_name: item.closed_by ? profileMap.get(item.closed_by) || 'Utilisateur inconnu' : null,
                closed_at: item.closed_at,
                created_at: item.created_at,
                updated_at: item.updated_at,
                latitude: item.latitude ?? null,
                longitude: item.longitude ?? null,
                media_urls: parseMediaUrls(item.media_urls),
                materials: parseIncidentMaterials(item.incident_materials),
                materials_summary: formatMaterialsSummary(
                    parseIncidentMaterials(item.incident_materials),
                    item.equipment_used || ''
                ),
            }));
        }

        return [];
    },

    /**
     * Fetches the latest open incidents (default 3) for the dashboard.
     */
    async getLatestOpenIncidents(limit = 3): Promise<Incident[]> {
        return this.getIncidents(limit, undefined, { status: 'open' });
    },

    /**
     * Strictly Online mutation logic with Zod checking.
     */
    async updateIncidentStatus(updatePayload: AdminIncidentUpdate): Promise<void> {
        // 1. Zod boundary validation
        const validPayload = AdminIncidentUpdateSchema.parse(updatePayload);

        // 2. Strict Offline check (prevent write-skew)
        await assertOnline();

        // 3. Online mutate
        const { error } = await supabase
            .from('incidents')
            .update({ status: validPayload.status })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Mutation failed: ${error.message}`);
    },

    async closeIncidentWithMaterials(closurePayload: AdminIncidentClosure): Promise<void> {
        const validPayload = AdminIncidentClosureSchema.parse(closurePayload);

        await assertOnline();

        const materials: IncidentMaterialInput[] = validPayload.materials.map((material) => ({
            client_material_id: material.client_material_id,
            material_name: material.material_name,
            quantity: material.quantity,
        }));

        const { error: materialsError } = await supabase.rpc('upsert_incident_materials', {
            p_incident_id: validPayload.id,
            p_materials: materials,
        });

        if (materialsError) {
            throw new Error(`Material update failed: ${materialsError.message}`);
        }

        const { error } = await supabase
            .from('incidents')
            .update({
                status: 'closed',
                equipment_used: buildEquipmentSummary(materials),
            })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Mutation failed: ${error.message}`);
    }
};

async function assertOnline(): Promise<void> {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
        throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
    }
}

function getEmbeddedCommuneName(
    value: IncidentListRecord['communes']
): string {
    if (Array.isArray(value)) {
        return value[0]?.name || 'Commune Inconnue';
    }
    return value?.name || 'Commune Inconnue';
}

function parseMediaUrls(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((url): url is string => typeof url === 'string')
        : [];
}

function parseIncidentMaterials(value: unknown): IncidentMaterialSummary[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const materialName = typeof record.material_name === 'string' ? record.material_name : '';
        const quantity = Number(record.quantity);
        return materialName && Number.isFinite(quantity) && quantity > 0
            ? [{ material_name: materialName, quantity }]
            : [];
    });
}
