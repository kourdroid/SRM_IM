import type { SQLiteDatabase } from 'expo-sqlite';
import type { IncidentRow } from '@/db/incidents';
import { getIncidentMaterialsByLocalId } from '@/db/incidentMaterials';
import { formatMaterialsSummary } from './materials';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type IncidentShareData = {
  reference: string; type: 'BT' | 'MT'; date: string; status: 'open' | 'closed';
  incidentType: string; commune: string; village: string; departHta: string;
  description: string; materials: string; reclamation: boolean; synced: boolean;
};

export async function loadIncidentShareData(db: SQLiteDatabase, id: number, userId: string): Promise<IncidentShareData> {
  if (!Number.isSafeInteger(id) || id <= 0 || !userId) throw new Error('Incident indisponible.');
  const incident = await db.getFirstAsync<IncidentRow>(
    'SELECT * FROM incidents WHERE id = ? AND created_by = ? AND archived_at IS NULL', [id, userId]);
  if (!incident) throw new Error('Cet incident est indisponible pour votre compte.');
  const [commune, materials] = await Promise.all([
    db.getFirstAsync<{ name: string }>('SELECT name FROM communes WHERE remote_id = ? OR CAST(id AS TEXT) = ? LIMIT 1', [incident.commune_id, incident.commune_id]),
    getIncidentMaterialsByLocalId(db, incident.id),
  ]);
  return {
    reference: (incident.client_id || incident.remote_id || String(incident.id)).slice(0, 8).toUpperCase(),
    type: incident.type, date: incident.date, status: incident.status,
    incidentType: incident.incident_type || 'Incident terrain', commune: commune?.name || '',
    village: incident.village, departHta: incident.type === 'MT' ? incident.depart_hta || '' : '',
    description: incident.description || '',
    materials: formatMaterialsSummary(materials, incident.equipment_used || ''),
    reclamation: Boolean(incident.reclamation),
    synced: incident.sync_status === 'synced' || (!incident.sync_status && incident.synced === 1),
  };
}

export function shareIncidentDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date non renseignée' : new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

// Conservative glyph widths leave room for Inter and platform fallback fonts.
export function wrapShareText(value: string, fontSize: number, width = 624): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r/g, '').split('\n')) {
    let line = '', used = 0;
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const glyphs = Array.from(word);
      const measure = (character: string) => fontSize * (/[MW@%\u2E80-\u9FFF]/u.test(character) ? 1.05 : character === ' ' ? 0.4 : 0.74);
      const wordWidth = glyphs.reduce((total, character) => total + measure(character), 0);
      if (line && used + fontSize * 0.4 + wordWidth > width) { lines.push(line); line = ''; used = 0; }
      if (line) { line += ' '; used += fontSize * 0.4; }
      for (const character of glyphs) {
        const size = measure(character);
        if (line && used + size > width) { lines.push(line); line = ''; used = 0; }
        line += character; used += size;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function incidentShareSections(data: IncidentShareData) {
  // shortcut: bound optional text to keep PNG memory suitable for field phones; use a paginated report for full exports.
  const shorten = (text: string, max: number) => {
    const characters = Array.from(text.trim());
    return characters.length > max ? characters.slice(0, max).join('') + '… [suite dans Intervx]' : characters.join('');
  };
  return [
    ['TYPE D’INCIDENT', shorten(data.incidentType, 160)],
    ['COMMUNE', shorten(data.commune, 160)],
    ['LOCALITÉ', shorten(data.village, 200)],
    ['DÉPART HTA', shorten(data.departHta, 160)],
    ['DESCRIPTION', shorten(data.description, 1000)],
    ['MATÉRIEL', shorten(data.materials, 500)],
  ].filter(([, value]) => value).map(([label, value]) => {
    const lines = wrapShareText(value, 25);
    const limit = label === 'DESCRIPTION' ? 24 : label === 'MATÉRIEL' ? 12 : 6;
    return { label, lines: lines.length > limit ? [...lines.slice(0, limit - 1), '… [suite dans Intervx]'] : lines };
  });
}

export function expiredIncidentShareFiles(names: string[], now = Date.now()): string[] {
  return names.filter(name => {
    const match = /^intervx-incident-\d+-(\d+)\.png$/.exec(name);
    return match !== null && Number(match[1]) < now - 86400000;
  });
}

export async function shareIncidentPng(base64: string, incidentId: number, isCurrent: () => boolean): Promise<void> {
  if (!base64 || !FileSystem.cacheDirectory) throw new Error('Impossible de préparer l’image.');
  if (!isCurrent()) return;
  const directory = `${FileSystem.cacheDirectory}incident_shares/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  for (const expired of expiredIncidentShareFiles(await FileSystem.readDirectoryAsync(directory))) {
    await FileSystem.deleteAsync(directory + expired, { idempotent: true }).catch(() => undefined);
  }
  const file = `${directory}intervx-incident-${incidentId}-${Date.now()}.png`;
  let handedToShareSheet = false;
  try {
    await FileSystem.writeAsStringAsync(file, base64, { encoding: FileSystem.EncodingType.Base64 });
    if (!isCurrent()) return;
    handedToShareSheet = true;
    await Sharing.shareAsync(file, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Partager l’incident Intervx' });
  } finally {
    // Receiving apps may read after the Android chooser closes; prune these cache files on the next day's share.
    if (!handedToShareSheet) await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => undefined);
  }
}
