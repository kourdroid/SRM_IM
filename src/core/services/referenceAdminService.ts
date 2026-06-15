import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';
import {
    DepartHtaOptionMutationSchema,
    IncidentTypeOptionMutationSchema,
} from '../entities/admin';

export type NetworkType = 'BT' | 'MT';

export interface AdminIncidentTypeOption {
    id: string;
    network_type: NetworkType;
    name: string;
    active: boolean;
    sort_order: number;
    incident_count: number;
}

export interface AdminDepartHtaOption {
    id: string;
    name: string;
    active: boolean;
    sort_order: number;
    incident_count: number;
}

interface AdminIncidentTypeRpcRow {
    id: string;
    network_type: NetworkType;
    name: string;
    active: boolean;
    sort_order: number | string | null;
    incident_count: number | string | null;
}

interface AdminDepartHtaRpcRow {
    id: string;
    name: string;
    active: boolean;
    sort_order: number | string | null;
    incident_count: number | string | null;
}

function normalizeIncidentType(row: AdminIncidentTypeRpcRow): AdminIncidentTypeOption {
    return {
        id: row.id,
        network_type: row.network_type,
        name: row.name,
        active: row.active === true,
        sort_order: Number(row.sort_order || 0),
        incident_count: Number(row.incident_count || 0),
    };
}

function normalizeDepartHta(row: AdminDepartHtaRpcRow): AdminDepartHtaOption {
    return {
        id: row.id,
        name: row.name,
        active: row.active === true,
        sort_order: Number(row.sort_order || 0),
        incident_count: Number(row.incident_count || 0),
    };
}

function requireIncidentTypeRpcRow(data: unknown): AdminIncidentTypeRpcRow {
    const rows = data as AdminIncidentTypeRpcRow[] | null;
    if (!rows?.[0]) {
        throw new Error('Incident type mutation returned no row.');
    }
    return rows[0];
}

function requireDepartHtaRpcRow(data: unknown): AdminDepartHtaRpcRow {
    const rows = data as AdminDepartHtaRpcRow[] | null;
    if (!rows?.[0]) {
        throw new Error('Départ HTA mutation returned no row.');
    }
    return rows[0];
}

async function assertOnline(): Promise<void> {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
        throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
    }
}

export const IncidentTypeAdminService = {
    async getOptions(): Promise<AdminIncidentTypeOption[]> {
        const { data, error } = await supabase.rpc('get_admin_incident_type_options');

        if (error) {
            throw new Error(`Fetch incident types failed: ${error.message}`);
        }

        return ((data || []) as AdminIncidentTypeRpcRow[]).map(normalizeIncidentType);
    },

    async createOption(networkType: NetworkType, name: string): Promise<AdminIncidentTypeOption> {
        await assertOnline();
        const payload = IncidentTypeOptionMutationSchema.parse({
            network_type: networkType,
            name,
        });

        const { data, error } = await supabase.rpc('create_incident_type_option_by_admin', {
            p_network_type: payload.network_type,
            p_name: payload.name,
        });

        if (error) {
            throw new Error(`Create incident type failed: ${error.message}`);
        }

        return normalizeIncidentType(requireIncidentTypeRpcRow(data));
    },

    async updateOption(option: {
        id: string;
        network_type: NetworkType;
        name: string;
        active: boolean;
        sort_order: number;
    }): Promise<AdminIncidentTypeOption> {
        await assertOnline();
        const payload = IncidentTypeOptionMutationSchema.required({
            id: true,
            active: true,
            sort_order: true,
        }).parse(option);

        const { data, error } = await supabase.rpc('update_incident_type_option_by_admin', {
            p_id: payload.id,
            p_network_type: payload.network_type,
            p_name: payload.name,
            p_active: payload.active,
            p_sort_order: payload.sort_order,
        });

        if (error) {
            throw new Error(`Update incident type failed: ${error.message}`);
        }

        return normalizeIncidentType(requireIncidentTypeRpcRow(data));
    },

    async deleteOption(id: string): Promise<void> {
        await assertOnline();
        IncidentTypeOptionMutationSchema.pick({ id: true }).parse({ id });

        const { error } = await supabase.rpc('delete_incident_type_option_by_admin', {
            p_id: id,
        });

        if (error) {
            throw new Error(`Delete incident type failed: ${error.message}`);
        }
    },
};

export const DepartHtaAdminService = {
    async getOptions(): Promise<AdminDepartHtaOption[]> {
        const { data, error } = await supabase.rpc('get_admin_depart_hta_options');

        if (error) {
            throw new Error(`Fetch Départs HTA failed: ${error.message}`);
        }

        return ((data || []) as AdminDepartHtaRpcRow[]).map(normalizeDepartHta);
    },

    async createOption(name: string): Promise<AdminDepartHtaOption> {
        await assertOnline();
        const payload = DepartHtaOptionMutationSchema.parse({ name });

        const { data, error } = await supabase.rpc('create_depart_hta_option_by_admin', {
            p_name: payload.name,
        });

        if (error) {
            throw new Error(`Create Départ HTA failed: ${error.message}`);
        }

        return normalizeDepartHta(requireDepartHtaRpcRow(data));
    },

    async updateOption(option: {
        id: string;
        name: string;
        active: boolean;
        sort_order: number;
    }): Promise<AdminDepartHtaOption> {
        await assertOnline();
        const payload = DepartHtaOptionMutationSchema.required({
            id: true,
            active: true,
            sort_order: true,
        }).parse(option);

        const { data, error } = await supabase.rpc('update_depart_hta_option_by_admin', {
            p_id: payload.id,
            p_name: payload.name,
            p_active: payload.active,
            p_sort_order: payload.sort_order,
        });

        if (error) {
            throw new Error(`Update Départ HTA failed: ${error.message}`);
        }

        return normalizeDepartHta(requireDepartHtaRpcRow(data));
    },
};
