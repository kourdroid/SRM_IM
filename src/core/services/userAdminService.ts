import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';
import { UserRoleUpdateSchema, type UserRoleUpdate } from '../entities/admin';

export interface UserProfile {
    id: string;
    role: 'field' | 'admin';
    name: string | null;
    email: string | null;
}

export const UserAdminService = {
    /**
     * Fetches all registered user profiles
     */
    async getProfiles(): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('role', { ascending: false });

        if (error) throw new Error(`Fetch profiles failed: ${error.message}`);

        // We expect profiles to have id, role, full_name, etc.
        return data as UserProfile[];
    },

    /**
     * Strictly Online mutation logic enforcing Binary Roles (field | admin)
     */
    async updateUserRole(updatePayload: UserRoleUpdate): Promise<void> {
        // 1. Zod boundary validation to prevent injection of 'super-admin'
        const validPayload = UserRoleUpdateSchema.parse(updatePayload);

        // 2. Strict Offline check (prevent write-skew)
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        // 3. Online mutate
        const { error } = await supabase
            .from('user_profiles')
            .update({ role: validPayload.role })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Role mutation failed: ${error.message}`);
    }
};
