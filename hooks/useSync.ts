import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { sync } from '../lib/sync';

export function useSync(userId?: string) {
    const db = useSQLiteContext();
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const syncPendingItems = useCallback(async () => {
        // Use ref to prevent concurrent sync calls without causing re-renders
        if (isSyncingRef.current) return;
        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            await sync(db, userId);
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [db, userId]);

    return { isSyncing, syncPendingItems };
}
