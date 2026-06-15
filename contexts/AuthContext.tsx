import { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isOperationTimeoutError, withTimeout } from '../lib/asyncTimeout';
import {
  handleInvalidSupabaseSession,
  hasRemoteNetwork,
  isSupabaseNetworkError,
  supabase,
} from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  startupIssue: StartupIssue;
  role: UserRole | null;
  approvalStatus: UserApprovalStatus | null;
  isApproved: boolean;
  isAdmin: boolean;
  isDirector: boolean;
  retryStartup: () => void;
};

type UserRole = 'field' | 'admin' | 'director';
type UserApprovalStatus = 'pending' | 'approved' | 'rejected';
export type StartupIssue = 'SESSION_TIMEOUT' | 'PROFILE_TIMEOUT' | 'PROFILE_UNAVAILABLE' | 'INVALID_SESSION' | null;
type CachedUserProfileState = {
  role: UserRole;
  approvalStatus: UserApprovalStatus;
};

const SESSION_RESTORE_TIMEOUT_MS = 8000;
const PROFILE_FETCH_TIMEOUT_MS = 8000;
const NETWORK_CHECK_TIMEOUT_MS = 3000;

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  startupIssue: null,
  role: null,
  approvalStatus: null,
  isApproved: false,
  isAdmin: false,
  isDirector: false,
  retryStartup: () => undefined,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupIssue, setStartupIssue] = useState<StartupIssue>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<UserApprovalStatus | null>(null);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setRole(null);
    setApprovalStatus(null);
  }, []);

  const checkUserRole = useCallback(async (userId: string): Promise<boolean> => {
    const cachedRole = await getCachedRole(userId);
    const cachedProfileState = await getCachedProfileState(userId);
    if (cachedProfileState) {
      setRole(cachedProfileState.role);
      setApprovalStatus(cachedProfileState.approvalStatus);
    } else if (cachedRole) {
      setRole(cachedRole);
      setApprovalStatus('approved');
    }

    try {
      const hasNetwork = await withTimeout(hasRemoteNetwork(), NETWORK_CHECK_TIMEOUT_MS, 'NETWORK_TIMEOUT');
      if (!hasNetwork) {
        return Boolean(cachedProfileState || cachedRole);
      }

      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase
            .from('user_profiles')
            .select('role, approval_status')
            .eq('id', userId)
            .single()
        ),
        PROFILE_FETCH_TIMEOUT_MS,
        'PROFILE_TIMEOUT'
      );

      if (error) {
        if (await handleInvalidSupabaseSession(error)) {
          clearAuthState();
          setStartupIssue('INVALID_SESSION');
          return false;
        }
        setStartupIssue(cachedProfileState || cachedRole ? null : 'PROFILE_UNAVAILABLE');
        return Boolean(cachedProfileState || cachedRole);
      }

      const nextRole = parseRole(data?.role);
      const nextApprovalStatus = parseApprovalStatus(data?.approval_status);
      setRole(nextRole);
      setApprovalStatus(nextApprovalStatus);
      setStartupIssue(null);
      await setCachedProfileState(userId, {
        role: nextRole,
        approvalStatus: nextApprovalStatus,
      });
      return true;
    } catch (error) {
      if (await handleInvalidSupabaseSession(error)) {
        clearAuthState();
        setStartupIssue('INVALID_SESSION');
        return false;
      }
      if (cachedProfileState || cachedRole) {
        setStartupIssue(null);
        return true;
      }
      if (isOperationTimeoutError(error, 'PROFILE_TIMEOUT') || isOperationTimeoutError(error, 'NETWORK_TIMEOUT')) {
        setStartupIssue('PROFILE_TIMEOUT');
      } else if (!isSupabaseNetworkError(error)) {
        console.warn('Role check failed:', error);
        setStartupIssue('PROFILE_UNAVAILABLE');
      } else {
        setStartupIssue('PROFILE_UNAVAILABLE');
      }
      return false;
    }
  }, [clearAuthState]);

  const bootstrapAuth = useCallback(async () => {
    setLoading(true);
    setStartupIssue(null);
    try {
      const {
        data: { session: restoredSession },
      } = await withTimeout(supabase.auth.getSession(), SESSION_RESTORE_TIMEOUT_MS, 'SESSION_TIMEOUT');
      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);
      if (restoredSession?.user) {
        const resolved = await checkUserRole(restoredSession.user.id);
        if (!resolved) {
          setStartupIssue((current) => current || 'PROFILE_UNAVAILABLE');
        }
      } else {
        setRole(null);
        setApprovalStatus(null);
      }
    } catch (error) {
      if (await handleInvalidSupabaseSession(error)) {
        clearAuthState();
        setStartupIssue('INVALID_SESSION');
      } else if (isOperationTimeoutError(error, 'SESSION_TIMEOUT')) {
        clearAuthState();
        setStartupIssue('SESSION_TIMEOUT');
      } else if (!isSupabaseNetworkError(error)) {
        console.warn('Session restore failed:', error);
        clearAuthState();
        setStartupIssue('PROFILE_UNAVAILABLE');
      } else {
        clearAuthState();
        setStartupIssue('SESSION_TIMEOUT');
      }
    } finally {
      setLoading(false);
    }
  }, [checkUserRole, clearAuthState]);

  useEffect(() => {
    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setStartupIssue(null);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserRole(session.user.id);
        } else {
          setRole(null);
          setApprovalStatus(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [bootstrapAuth, checkUserRole]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      startupIssue,
      role,
      approvalStatus,
      isApproved: approvalStatus === 'approved',
      isAdmin: role === 'admin' && approvalStatus === 'approved',
      isDirector: role === 'director' && approvalStatus === 'approved',
      retryStartup: () => {
        void bootstrapAuth();
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

function parseRole(value: unknown): UserRole {
  return value === 'admin' || value === 'director' ? value : 'field';
}

function parseApprovalStatus(value: unknown): UserApprovalStatus {
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

async function getCachedRole(userId: string): Promise<UserRole | null> {
  const value = await SecureStore.getItemAsync(buildProfileCacheKey('role', userId)).catch(() => null);
  if (value === 'admin' || value === 'director' || value === 'field') {
    return value;
  }
  return null;
}

async function setCachedRole(userId: string, nextRole: UserRole): Promise<void> {
  await SecureStore.setItemAsync(buildProfileCacheKey('role', userId), nextRole).catch(() => undefined);
}

async function getCachedProfileState(userId: string): Promise<CachedUserProfileState | null> {
  const value = await SecureStore.getItemAsync(buildProfileCacheKey('profile', userId)).catch(() => null);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<CachedUserProfileState>;
    const role = parseRole(parsed.role);
    const approvalStatus = parseApprovalStatus(parsed.approvalStatus);
    return { role, approvalStatus };
  } catch {
    return null;
  }
}

async function setCachedProfileState(
  userId: string,
  profileState: CachedUserProfileState
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(buildProfileCacheKey('profile', userId), JSON.stringify(profileState)),
    setCachedRole(userId, profileState.role),
  ]).catch(() => undefined);
}

function buildProfileCacheKey(kind: 'role' | 'profile', userId: string): string {
  return `srm_${kind}_${userId.replace(/[^A-Za-z0-9]/g, '')}`;
}
