#!/usr/bin/env node
// Converts the "RÉSEAU DPSB" Google My Maps export into SQL that loads network_postes and network_departs.
// The network geometry stays out of git: pass the extracted doc.kml and write the SQL outside the repo.
//
//   node scripts/import-network-kml.cjs <doc.kml> <out.sql>
//   npx supabase db query --remote --file <out.sql>
//
// Re-running replaces the whole network (the tables only hold this import).

const fs = require('node:fs');

const [, , kmlPath, outPath] = process.argv;
if (!kmlPath || !outPath) {
  console.error('Usage: node scripts/import-network-kml.cjs <doc.kml> <out.sql>');
  process.exit(1);
}

const HTA_FOLDER = 'RESEAU HTA DPJ';
const POSTES_FOLDER = 'POSTES SOURCES';

// Spelling variants in the source map, folded onto the main départ.
const DEPART_ALIASES = {
  'BIR JDID|LAMHRAZA': 'BIR JDID|LAMHARZA',
  'DAOURAT|OD FREJ': 'DAOURAT|HAD OD FREJ',
  'DAOURAT-SB|HAD OD FREJ': 'DAOURAT|HAD OD FREJ',
};

// The two layers spell some postes differently; both are normalised to one name so lines and points share a color.
const POSTE_NAMES = {
  'BIR_JDID': 'BIR JDID',
  'MAACHOU2': 'MAACHOU II',
  'S.A.B.H.': 'SIDI ALI BEN HAMDOUCH',
};
const posteName = (name) => POSTE_NAMES[name] ?? name;

// Source-map départ -> depart_hta_options.name used by the mobile app.
const APP_DEPART_NAMES = {
  'EL OUALIDIA|CAP BEDOUZA': 'Oualidia - Beddouza',
  'EL OUALIDIA|CENTRE': 'Oualidia - Centre',
  'EL OUALIDIA|RURAL': 'Oualidia - Rural',
  'EL OUALIDIA|ZMAMRA': 'Oualidia - Zemamra',
  'SIDI BENNOUR|SIDI SMAIL_SB': 'Sidi bennou - Sidi Smail',
  'SIDI BENNOUR|BIR LAABID': 'Sidi bennour - Bir Laabid',
  'SIDI BENNOUR|CENTRE 1_SB': 'Sidi bennour - Centre 1',
  'SIDI BENNOUR|CENTRE 2_SB': 'Sidi bennour - Centre 2',
  'SIDI BENNOUR|KH. KSIBA': 'Sidi bennour - Khmis ksiba',
  'SIDI BENNOUR|AL AOUNATE': 'Sidi bennour - Laaounate',
  'SIDI BENNOUR|OD AMRANE': 'Sidi bennour - Od amrane',
  'SIDI BENNOUR|OD FREJ': 'Sidi bennour - Od frej',
  'SIDI BENNOUR|RTM': 'Sidi bennour - RTM',
  'SIDI BENNOUR|SUCRERIE_SB': 'Sidi bennour - Sucrerie',
  'SIDI BENNOUR|ZEMAMRA': 'Sidi bennour - Zemamra',
  'YOUSSOUFIA|HORMAT ALLAH': 'Youssoufia -Hormat ALLAH',
  'ZEMAMRA|CENTRE_ZMR': 'Zemamra - Centre',
  'ZEMAMRA|TNINE LGHARBIA': 'Zemamra - Elgharbia',
  'ZEMAMRA|OUALIDIA': 'Zemamra - Oualidia',
  'ZEMAMRA|SEBT SAISS': 'Zemamra - Sebt sais',
  'ZEMAMRA|SIDI BENNOUR': 'Zemamra - Sidi bennour',
  'ZEMAMRA|SUCRERIE': 'Zemamra - Sucrerie',
  'ZEMAMRA|Z0': 'Zemamra - Z0',
  'ZEMAMRA|Z1-Z2': 'Zemamra - Z1Z2',
  'ZEMAMRA|Z3': 'Zemamra - Z3',
};

const kml = fs.readFileSync(kmlPath, 'utf8');

function folderBody(name) {
  for (const match of kml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)) {
    const title = /<name>([\s\S]*?)<\/name>/.exec(match[1])?.[1].trim();
    if (title === name) return match[1];
  }
  throw new Error(`Folder "${name}" not found`);
}

function placemarks(body) {
  return [...body.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)].map(match => {
    const xml = match[1];
    const data = {};
    for (const d of xml.matchAll(/<Data name="([^"]*)">\s*<value>([\s\S]*?)<\/value>/g)) {
      data[d[1].normalize('NFC')] = decode(d[2]).trim();
    }
    return {
      name: decode(/<name>([\s\S]*?)<\/name>/.exec(xml)?.[1] ?? '').trim(),
      data,
      lines: [...xml.matchAll(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map(c => parseCoords(c[1])),
      point: (() => {
        const p = /<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(xml);
        return p ? parseCoords(p[1])[0] : null;
      })(),
    };
  });
}

function decode(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// 5 decimals is about one metre: enough for a supervision map, and roughly halves the payload.
function parseCoords(text) {
  return text.trim().split(/\s+/).map(pair => {
    const [lng, lat] = pair.split(',').map(Number);
    return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  }).filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function lengthKm(line) {
  let km = 0;
  for (let i = 1; i < line.length; i += 1) {
    const [lng1, lat1] = line[i - 1];
    const [lng2, lat2] = line[i];
    const dx = (lng2 - lng1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    const dy = (lat2 - lat1) * 110.57;
    km += Math.hypot(dx, dy);
  }
  return km;
}

const departs = new Map();
let skipped = 0;
for (const pm of placemarks(folderBody(HTA_FOLDER))) {
  const poste = pm.data['Poste source'] ?? '';
  const depart = pm.data['Départ'] ?? '';
  if (!poste || !depart || pm.lines.length === 0) { skipped += 1; continue; }
  const rawKey = `${poste}|${depart}`;
  const key = DEPART_ALIASES[rawKey] ?? rawKey;
  const [keyPoste, keyDepart] = key.split('|');
  if (!departs.has(key)) {
    departs.set(key, { poste: posteName(keyPoste), depart: keyDepart, aerial: [], underground: [], aerialKm: 0, undergroundKm: 0 });
  }
  const entry = departs.get(key);
  const underground = (pm.data['Type ligne'] ?? '').toUpperCase() === 'S';
  for (const line of pm.lines) {
    if (line.length < 2) continue;
    if (underground) { entry.underground.push(line); entry.undergroundKm += lengthKm(line); }
    else { entry.aerial.push(line); entry.aerialKm += lengthKm(line); }
  }
}

const postes = placemarks(folderBody(POSTES_FOLDER)).filter(pm => pm.point).map(pm => ({ name: posteName(pm.name), point: pm.point }));

const sql = (value) => value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
const multi = (lines) => lines.length ? sql(JSON.stringify({ type: 'MultiLineString', coordinates: lines })) + '::jsonb' : 'NULL';

const statements = [
  'BEGIN;',
  'DELETE FROM public.network_departs;',
  'DELETE FROM public.network_postes;',
  ...postes.map(p => `INSERT INTO public.network_postes (name, longitude, latitude) VALUES (${sql(p.name)}, ${p.point[0]}, ${p.point[1]});`),
  ...[...departs.entries()].map(([key, d]) => {
    const appName = APP_DEPART_NAMES[key] ?? null;
    const optionId = appName ? `(SELECT id FROM public.depart_hta_options WHERE name = ${sql(appName)})` : 'NULL';
    return `INSERT INTO public.network_departs (poste_source, depart, depart_hta_option_id, aerial_km, underground_km, aerial_geometry, underground_geometry) VALUES (${sql(d.poste)}, ${sql(d.depart)}, ${optionId}, ${d.aerialKm.toFixed(2)}, ${d.undergroundKm.toFixed(2)}, ${multi(d.aerial)}, ${multi(d.underground)});`;
  }),
  'COMMIT;',
];

fs.writeFileSync(outPath, statements.join('\n') + '\n');

const unmatched = Object.keys(APP_DEPART_NAMES).filter(key => !departs.has(key));
const totalKm = [...departs.values()].reduce((sum, d) => sum + d.aerialKm + d.undergroundKm, 0);
console.log(`postes: ${postes.length}, départs: ${departs.size}, km: ${totalKm.toFixed(0)}, skipped placemarks: ${skipped}`);
console.log(`linked to app départs: ${Object.keys(APP_DEPART_NAMES).length - unmatched.length}`);
if (unmatched.length) console.log(`mapping keys missing from the map: ${unmatched.join(', ')}`);
console.log(`SQL: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
