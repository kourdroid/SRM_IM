import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { UserRoleUpdateSchema, type UserRoleUpdate } from '../entities/admin';

export interface UserProfile {
    id: string;
    role: 'field' | 'admin';
    name: string | null;
    email: string | null;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Temporary client with persistSession: false to prevent session hijacking
const createTempClient = () => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
};

export const UserAdminService = {
    /**
     * Fetches all registered user profiles using the get_admin_users RPC
     */
    async getProfiles(): Promise<UserProfile[]> {
        const { data, error } = await supabase.rpc('get_admin_users');

        if (error) {
            // Fallback to direct table query if RPC is not migrated yet
            console.warn('Fallback to direct user_profiles selection:', error.message);
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('user_profiles')
                .select('*')
                .order('role', { ascending: false });

            if (fallbackError) throw new Error(`Fetch profiles failed: ${fallbackError.message}`);
            return (fallbackData || []).map(p => ({
                id: p.id,
                role: p.role,
                name: p.name,
                email: null // Direct query has no email
            }));
        }

        return (data || []) as UserProfile[];
    },

    /**
     * Strictly Online mutation logic enforcing Binary Roles (field | admin)
     */
    async updateUserRole(updatePayload: UserRoleUpdate): Promise<void> {
        const validPayload = UserRoleUpdateSchema.parse(updatePayload);

        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({ role: validPayload.role })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Role mutation failed: ${error.message}`);
    },

    /**
     * Creates a new user auth account and profile without swapping the admin's session.
     */
    async createUser(email: string, password: string, name: string, role: 'field' | 'admin'): Promise<UserProfile> {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        const tempClient = createTempClient();
        
        // 1. Create authentication credentials
        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email,
            password,
        });

        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error('Failed to create user credentials.');

        // 2. Insert user profile inside user_profiles table
        const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
                id: authData.user.id,
                name: name,
                role: role,
            });

        if (profileError) {
            // Attempt to clean up orphan user from auth.users
            await supabase.rpc('delete_user_by_admin', { user_id: authData.user.id }).catch(() => {});
            throw new Error(`Profile setup failed: ${profileError.message}`);
        }

        return {
            id: authData.user.id,
            role: role,
            name: name,
            email: email,
        };
    },

    /**
     * Deletes a user account securely using PostgreSQL RPC.
     */
    async deleteUser(userId: string): Promise<void> {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        const { error } = await supabase.rpc('delete_user_by_admin', { user_id: userId });

        if (error) throw new Error(`Delete user failed: ${error.message}`);
    }
};
