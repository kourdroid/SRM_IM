import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseNetworkError } from '@/lib/supabase';
import { syncAll } from '@/lib/sync';

export default function SyncCoordinator() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const isRunningRef = useRef(false);

  const runSync = useCallback(async (reason: 'startup' | 'foreground' | 'network' = 'foreground') => {
    if (!user?.id || isRunningRef.current) return;

    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) return;

    try {
      isRunningRef.current = true;
      await syncAll(db, user.id, { reason });
    } catch (error) {
      if (isSupabaseNetworkError(error)) {
        console.warn('Background sync deferred: Supabase is unreachable.');
      } else {
        console.error('Background sync failed:', error);
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [db, user?.id]);

  useEffect(() => {
    void runSync('startup');

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runSync('foreground');
      }
    });

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void runSync('network');
      }
    });

    const interval = setInterval(() => {
      void runSync('foreground');
    }, 5 * 60 * 1000);

    return () => {
      appStateSubscription.remove();
      networkSubscription.remove();
      clearInterval(interval);
    };
  }, [runSync]);

  return null;
}
