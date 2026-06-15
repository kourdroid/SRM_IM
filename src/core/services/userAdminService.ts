import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import {
    UserApprovalStatusUpdateSchema,
    UserRoleUpdateSchema,
    type UserApprovalStatusUpdate,
    type UserRoleUpdate,
} from '../entities/admin';

export interface UserProfile {
    id: string;
    role: UserRole;
    approval_status: UserApprovalStatus;
    name: string | null;
    email: string | null;
}

export type UserRole = 'field' | 'admin' | 'director';
export type UserApprovalStatus = 'pending' | 'approved' | 'rejected';

interface AdminUserRpcRow {
    id: string;
    role: unknown;
    approval_status?: unknown;
    name?: string | null;
    email?: string | null;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

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
                role: parseRole(p.role),
                approval_status: parseApprovalStatus(p.approval_status),
                name: p.name || null,
                email: null // Direct query has no email
            }));
        }

        // Supabase RPC payloads are not typed from generated schema here; validate each dynamic field below.
        return ((data || []) as AdminUserRpcRow[]).map(profile => ({
            id: profile.id,
            role: parseRole(profile.role),
            approval_status: parseApprovalStatus(profile.approval_status),
            name: profile.name || null,
            email: profile.email || null,
        }));
    },

    /**
     * Strictly Online mutation logic enforcing controlled roles.
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
     * Approves or rejects a self-service signup. Admin-created users are approved during creation.
     */
    async updateUserApproval(updatePayload: UserApprovalStatusUpdate): Promise<void> {
        const validPayload = UserApprovalStatusUpdateSchema.parse(updatePayload);

        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({ approval_status: validPayload.approval_status })
            .eq('id', validPayload.id);

        if (error) throw new Error(`Approval mutation failed: ${error.message}`);
    },

    /**
     * Creates a new user auth account and profile without swapping the admin's session.
     * Requires "Auto Confirm" enabled in Supabase Auth settings to avoid sending emails.
     */
    async createUser(email: string, password: string, name: string, role: UserRole): Promise<UserProfile> {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            throw new Error('NETWORK_OFFLINE: Admin mutations require an active connection.');
        }

        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });
        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error('Failed to create user credentials.');

        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
                id: authData.user.id,
                name,
                role,
                approval_status: 'approved',
            }, { onConflict: 'id' });

        if (profileError) {
            const { error: rollbackError } = await supabase.rpc('delete_user_by_admin', {
                user_id: authData.user.id,
            });
            if (rollbackError) {
                console.warn('Failed to rollback auth user after profile setup error:', rollbackError.message);
            }
            throw new Error(`Profile setup failed: ${profileError.message}`);
        }

        return { id: authData.user.id, role, approval_status: 'approved', name, email };
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

function parseRole(value: unknown): UserRole {
    return value === 'admin' || value === 'director' ? value : 'field';
}

function parseApprovalStatus(value: unknown): UserApprovalStatus {
    if (value === 'approved' || value === 'rejected') return value;
    return 'pending';
}
