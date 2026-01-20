import type { SQLiteDatabase } from 'expo-sqlite';
import { upsertCommunesFromServer } from '../db/communes';
import { deleteInvalidIncidents, getUnsyncedIncidents, markIncidentsSynced, upsertIncidentsFromServer } from '../db/incidents';
import { supabase } from './supabase';

/**
 * Sync local database with Supabase
 */
export async function sync(db: SQLiteDatabase): Promise<void> {
    console.log('Sync: Starting...');

    try {
        // 0. Cleanup: Delete incidents with invalid commune_id (cannot sync)
        const deletedCount = await deleteInvalidIncidents(db);
        if (deletedCount > 0) {
            console.log(`Sync: Cleaned up ${deletedCount} incidents with invalid commune_id`);
        }

        // 1. Pull communes (static reference data)
        await pullCommunes(db);

        // 2. Pull incidents from server
        await pullIncidents(db);

        // 3. Push unsynced local incidents
        await pushIncidents(db);

        console.log('Sync: Complete');
    } catch (error) {
        console.error('Sync: Error', error);
        throw error;
    }
}

/**
 * Pull communes from Supabase
 */
async function pullCommunes(db: SQLiteDatabase): Promise<void> {
    const { data, error } = await supabase.from('communes').select('*');

    if (error) {
        console.error('Sync: Failed to pull communes', error);
        return;
    }

    if (data && data.length > 0) {
        await upsertCommunesFromServer(db, data);
        console.log(`Sync: Pulled ${data.length} communes`);
    }
}

/**
 * Pull incidents from Supabase
 */
async function pullIncidents(db: SQLiteDatabase): Promise<void> {
    const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Sync: Failed to pull incidents', error);
        return;
    }

    if (data && data.length > 0) {
        await upsertIncidentsFromServer(db, data);
        console.log(`Sync: Pulled ${data.length} incidents`);
    }
}

/**
 * Push unsynced incidents to Supabase
 */
async function pushIncidents(db: SQLiteDatabase): Promise<void> {
    const unsynced = await getUnsyncedIncidents(db);

    if (unsynced.length === 0) {
        console.log('Sync: No unsynced incidents to push');
        return;
    }

    console.log(`Sync: Pushing ${unsynced.length} incidents`);

    // UUID validation regex
    const isValidUUID = (str: string | null) => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    };

    // Filter out incidents with invalid commune_id (Supabase requires NOT NULL)
    const validIncidents = unsynced.filter((inc) => {
        if (!isValidUUID(inc.commune_id)) {
            console.warn(`Sync: Skipping incident ${inc.id} - invalid commune_id: "${inc.commune_id}"`);
            return false;
        }
        return true;
    });

    if (validIncidents.length === 0) {
        console.log('Sync: No valid incidents to push (all have invalid commune_id)');
        return;
    }

    const rows = validIncidents.map((inc) => ({
        type: inc.type,
        date: inc.date,
        village: inc.village,
        status: inc.status,
        incident_type: inc.incident_type,
        commune_id: inc.commune_id, // Guaranteed valid UUID now
        equipment_used: inc.equipment_used,
        description: inc.description,
        reclamation: inc.reclamation === 1,
        reclamation_name: inc.reclamation_name,
        reclamation_by: inc.reclamation_by,
        // Note: created_by is NOT sent - Supabase uses DEFAULT auth.uid()
        latitude: inc.latitude,
        longitude: inc.longitude,
    }));

    const { error, data } = await supabase.from('incidents').insert(rows).select();

    if (error) {
        console.error('Sync: Failed to push incidents');
        console.error('Sync: Error code:', error.code);
        console.error('Sync: Error message:', error.message);
        console.error('Sync: Error details:', error.details);
        console.error('Sync: Error hint:', error.hint);
        return;
    }

    // Mark as synced
    await markIncidentsSynced(
        db,
        validIncidents.map((i) => i.id)
    );
    console.log(`Sync: Pushed ${validIncidents.length} incidents successfully`);
}
