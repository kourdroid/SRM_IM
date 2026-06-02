import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { isSupabaseNetworkError } from '../lib/supabase';
import { syncAll, type SyncOptions } from '../lib/sync';

export function useSync(userId?: string) {
    const db = useSQLiteContext();
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const syncPendingItems = useCallback(async (options: SyncOptions = {}) => {
        // Use ref to prevent concurrent sync calls without causing re-renders
        if (isSyncingRef.current) return;
        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            await syncAll(db, userId, options);
        } catch (error) {
            if (isSupabaseNetworkError(error)) {
                console.warn('Sync deferred: Supabase is unreachable.');
            } else {
                console.error("Sync failed:", error);
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [db, userId]);

    return { isSyncing, syncPendingItems };
}
