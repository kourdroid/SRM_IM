import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';
import { AdminIncidentUpdateSchema, type AdminIncidentUpdate } from '../entities/admin';

// We fetch raw Incident arrays. We could use a standard typed interface.
export interface Incident {
    id: string;
    status: 'open' | 'closed';
    reclamation: boolean;
    created_at: string;
    description: string;
    location: string;
    images: string[];
    created_by: string;
    created_by_name?: string;
}

export const IncidentAdminService = {
    /**
     * Cursor-based fetching for infinite scrolling.
     */
    async getIncidents(limit = 20, lastCreatedAt?: string): Promise<Incident[]> {
        let query = supabase
            .from('incidents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (lastCreatedAt) {
            query = query.lt('created_at', lastCreatedAt);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Fetch incidents failed: ${error.message}`);

        const incidents = data as Incident[];

        // Fetch user profiles to map created_by to names
        if (incidents.length > 0) {
            const userIds = Array.from(new Set(incidents.map(i => i.created_by).filter(Boolean)));
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, name')
                    .in('id', userIds);
                
                if (profiles) {
                    const profileMap = new Map(profiles.map(p => [p.id, p.name]));
                    incidents.forEach(inc => {
                        if (inc.created_by) {
                            inc.created_by_name = profileMap.get(inc.created_by) || 'Unknown User';
                        }
                    });
                }
            }
        }

        return incidents;
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
        const { error } = await supabase
            .from('incidents')
            .update({ status: validPayload.status })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Mutation failed: ${error.message}`);
    }
};
