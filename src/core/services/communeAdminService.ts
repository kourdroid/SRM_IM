import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';
import { CommuneMutationSchema } from '../entities/admin';

export interface AdminCommune {
    id: string;
    name: string;
    incident_count: number;
}

interface AdminCommuneRpcRow {
    id: string;
    name: string;
    incident_count: number | string | null;
}

function normalizeCommune(row: AdminCommuneRpcRow): AdminCommune {
    return {
        id: row.id,
        name: row.name,
        incident_count: Number(row.incident_count || 0),
    };
}

function requireRpcRow(data: unknown): AdminCommuneRpcRow {
    const rows = data as AdminCommuneRpcRow[] | null;
    if (!rows?.[0]) {
        throw new Error('Commune mutation returned no row.');
    }
    return rows[0];
}

async function assertOnline(): Promise<void> {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
        throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
    }
}

export const CommuneAdminService = {
    async getCommunes(): Promise<AdminCommune[]> {
        const { data, error } = await supabase.rpc('get_admin_communes');

        if (error) {
            throw new Error(`Fetch communes failed: ${error.message}`);
        }

        return ((data || []) as AdminCommuneRpcRow[]).map(normalizeCommune);
    },

    async createCommune(name: string): Promise<AdminCommune> {
        await assertOnline();
        const payload = CommuneMutationSchema.parse({ name });

        const { data, error } = await supabase.rpc('create_commune_by_admin', {
            p_name: payload.name,
        });

        if (error) {
            throw new Error(`Create commune failed: ${error.message}`);
        }

        return normalizeCommune(requireRpcRow(data));
    },

    async updateCommune(id: string, name: string): Promise<AdminCommune> {
        await assertOnline();
        const payload = CommuneMutationSchema.parse({ id, name });

        const { data, error } = await supabase.rpc('update_commune_by_admin', {
            p_id: payload.id,
            p_name: payload.name,
        });

        if (error) {
            throw new Error(`Update commune failed: ${error.message}`);
        }

        return normalizeCommune(requireRpcRow(data));
    },

    async deleteCommune(id: string): Promise<void> {
        await assertOnline();
        CommuneMutationSchema.pick({ id: true }).parse({ id });

        const { error } = await supabase.rpc('delete_commune_by_admin', {
            p_id: id,
        });

        if (error) {
            throw new Error(`Delete commune failed: ${error.message}`);
        }
    },
};
