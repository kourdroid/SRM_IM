import { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
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
  role: UserRole | null;
  isAdmin: boolean;
  isDirector: boolean;
};

type UserRole = 'field' | 'admin' | 'director';

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  isDirector: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserRole(session.user.id);
        }
      } catch (error) {
        if (await handleInvalidSupabaseSession(error)) {
          setSession(null);
          setUser(null);
          setRole(null);
        } else if (!isSupabaseNetworkError(error)) {
          console.warn('Session restore failed:', error);
        }
        // Session fetch failed - user will need to log in
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserRole(session.user.id);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUserRole = async (userId: string) => {
    try {
      if (!(await hasRemoteNetwork())) {
        const cachedRole = await getCachedRole(userId);
        if (cachedRole) {
          setRole(cachedRole);
        }
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        if (await handleInvalidSupabaseSession(error)) {
          setSession(null);
          setUser(null);
          setRole(null);
        }
        // Role fetch failed - default to non-admin
        return;
      }

      const nextRole = parseRole(data?.role);
      setRole(nextRole);
      await setCachedRole(userId, nextRole);
    } catch (error) {
      if (await handleInvalidSupabaseSession(error)) {
        setSession(null);
        setUser(null);
        setRole(null);
      } else if (!isSupabaseNetworkError(error)) {
        console.warn('Role check failed:', error);
      }
      // Error checking role - default to non-admin
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      role,
      isAdmin: role === 'admin',
      isDirector: role === 'director',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

function parseRole(value: unknown): UserRole {
  return value === 'admin' || value === 'director' ? value : 'field';
}

async function getCachedRole(userId: string): Promise<UserRole | null> {
  const value = await SecureStore.getItemAsync(`srm:user-role:${userId}`).catch(() => null);
  if (value === 'admin' || value === 'director' || value === 'field') {
    return value;
  }
  return null;
}

async function setCachedRole(userId: string, nextRole: UserRole): Promise<void> {
  await SecureStore.setItemAsync(`srm:user-role:${userId}`, nextRole).catch(() => undefined);
}
