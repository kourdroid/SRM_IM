import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';
import { AdminIncidentUpdateSchema, type AdminIncidentUpdate } from '../entities/admin';

export interface Incident {
    id: string;
    remote_id?: string;
    type: 'BT' | 'MT';
    date: string;
    village: string;
    status: 'open' | 'closed';
    incident_type: string;
    commune_id: string;
    commune_name?: string;
    equipment_used: string;
    description: string;
    reclamation: boolean;
    reclamation_name?: string;
    reclamation_by?: string;
    created_by: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
    media_urls?: string[];
}

export interface IncidentFilters {
    status?: 'open' | 'closed' | 'all';
    type?: 'BT' | 'MT' | 'all';
    communeId?: string;
    reclamation?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
}

export const IncidentAdminService = {
    /**
     * Cursor-based fetching for infinite scrolling, supporting advanced filtering and search.
     */
    async getIncidents(limit = 20, lastCreatedAt?: string, filters?: IncidentFilters): Promise<Incident[]> {
        let query = supabase
            .from('incidents')
            .select('*, communes(name)')
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
                query = query.or(`description.ilike.%${filters.search.trim()}%,village.ilike.%${filters.search.trim()}%`);
            }
        }

        const { data, error } = await query;
        if (error) throw new Error(`Fetch incidents failed: ${error.message}`);

        const incidents = (data || []) as any[];

        // Map commune name and profiles
        if (incidents.length > 0) {
            const userIds = Array.from(new Set(incidents.map(i => i.created_by).filter(Boolean)));
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
                type: item.type,
                date: item.date,
                village: item.village,
                status: item.status,
                incident_type: item.incident_type,
                commune_id: item.commune_id,
                commune_name: item.communes?.name || 'Commune Inconnue',
                equipment_used: item.equipment_used,
                description: item.description || '',
                reclamation: item.reclamation === true || item.reclamation === 1,
                reclamation_name: item.reclamation_name,
                reclamation_by: item.reclamation_by,
                created_by: item.created_by,
                created_by_name: profileMap.get(item.created_by) || 'Anonymous User',
                created_at: item.created_at,
                updated_at: item.updated_at,
                media_urls: item.media_urls || []
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
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        // 3. Online mutate
        const updateData: any = { status: validPayload.status };
        if (validPayload.status === 'closed') {
            updateData.closed_at = new Date().toISOString();
        } else {
            updateData.closed_at = null;
        }

        const { error } = await supabase
            .from('incidents')
            .update(updateData)
            .eq('id', validPayload.id);

        if (error) throw new Error(`Mutation failed: ${error.message}`);
    }
};
