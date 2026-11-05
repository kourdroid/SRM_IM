const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const modules = new Map();
const files = { deleted: [], writes: [], shares: [], failWrite: false, afterWrite: null };
const fileSystem = {
  cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: async () => undefined,
  readDirectoryAsync: async () => ['intervx-incident-1-1.png', `intervx-incident-1-${Date.now()}.png`, 'original-photo.jpg'],
  deleteAsync: async uri => { files.deleted.push(uri); },
  writeAsStringAsync: async (...args) => {
    files.writes.push(args);
    if (files.failWrite) throw Error('Storage full');
    files.afterWrite?.();
  },
};
const sharing = { shareAsync: async (...args) => { files.shares.push(args); } };
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'expo-file-system/legacy') return fileSystem;
    if (name === 'expo-sharing') return sharing;
    if (name === 'react-native-svg') return { __esModule: true, default: 'svg', Rect: 'rect', Line: 'line', Text: 'text', TSpan: 'tspan' };
    if (name === 'react-native') return {};
    if (name === 'expo-sqlite' || name === '@/contexts/AuthContext' || name === '@expo/vector-icons') return {};
    if (name.startsWith('@/') || name.startsWith('.')) {
      const candidate = name.startsWith('@/') ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(fs.existsSync(candidate + '.tsx') ? candidate + '.tsx' : candidate + '.ts');
    }
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console, Date, Intl, Set, Promise, Error }, { filename })
    (localRequire, module, module.exports);
  modules.set(filename, module.exports);
  return module.exports;
}

(async () => {
  const service = load('lib/incidentShare.ts');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE incidents(id INTEGER PRIMARY KEY,client_id TEXT,remote_id TEXT,created_by TEXT,archived_at TEXT,type TEXT,date TEXT,status TEXT,incident_type TEXT,commune_id TEXT,village TEXT,depart_hta TEXT,description TEXT,equipment_used TEXT,reclamation INTEGER,sync_status TEXT,synced INTEGER);
    CREATE TABLE communes(id INTEGER PRIMARY KEY,remote_id TEXT,name TEXT);
    CREATE TABLE incident_materials(id INTEGER PRIMARY KEY,local_incident_id INTEGER,material_name TEXT,quantity REAL);
    INSERT INTO communes VALUES(1,'commune-A','Sidi Bennour');
    INSERT INTO incidents VALUES(1,'abcd1234-field',NULL,'field-A',NULL,'MT','2026-10-26T12:00:00Z','open','Rupture de conducteur','commune-A','Douar El Amal','Départ Oulad Frej','Conducteur endommagé. Intervention de l’équipe en cours.','',1,'pending',0);
    INSERT INTO incident_materials VALUES(1,1,'Câble aluminium',10);`);
  const db = {
    getFirstAsync: async (sql, parameters) => sqlite.prepare(sql).get(...parameters),
    getAllAsync: async (sql, parameters) => sqlite.prepare(sql).all(...parameters),
  };
  const data = await service.loadIncidentShareData(db, 1, 'field-A');
  assert.equal(data.materials, 'Câble aluminium x10');
  assert.equal(data.commune, 'Sidi Bennour');
  assert.equal(data.synced, false);
  assert.ok(service.shareIncidentDate(data.date).includes('13:00'));
  await assert.rejects(service.loadIncidentShareData(db, 1, 'field-B'), /compte/);
  await assert.rejects(service.loadIncidentShareData(db, NaN, 'field-A'));
  assert.ok(!('latitude' in data) && !('reclamation_name' in data), 'Do not export personal names or GPS automatically');
  assert.equal(service.shareIncidentDate('invalid'), 'Date non renseignée');
  const optional = service.incidentShareSections({ ...data, description: '', materials: '', departHta: '', commune: '' });
  assert.equal(optional.length, 2);
  const wrapped = service.wrapShareText('W'.repeat(100) + '\nحادث في الشبكة', 25);
  assert.ok(wrapped.every(line => Array.from(line).length < 34));
  assert.ok(wrapped.join('').includes('حادث'));
  const sections = service.incidentShareSections({ ...data, description: '\n'.repeat(1100), materials: 'Matériel '.repeat(1000) });
  assert.ok(sections.reduce((height, section) => height + 84 + section.lines.length * 33, 448) < 3500, 'Prevent unbounded export bitmaps');
  assert.ok(sections.some(section => section.lines.some(line => line.includes('suite dans IntervX'))));
  await service.shareIncidentPng('png-base64', 1, () => true);
  assert.equal(files.shares[0][1].mimeType, 'image/png');
  assert.ok(!files.deleted.includes(files.shares[0][0]), 'Receiver must retain access after chooser closes');
  assert.ok(files.deleted.every(uri => uri.startsWith('file:///cache/incident_shares/') && !uri.endsWith('original-photo.jpg')));
  const previousShares = files.shares.length;
  let active = true;
  files.afterWrite = () => { active = false; };
  await service.shareIncidentPng('png-base64', 1, () => active);
  assert.equal(files.shares.length, previousShares, 'Account switch must prevent sharing stale account data');
  files.afterWrite = null;
  files.failWrite = true;
  await assert.rejects(service.shareIncidentPng('png-base64', 1, () => true), /Storage full/);
  const { IncidentShareCard } = load('components/IncidentShareButton.tsx');
  const svg = renderToStaticMarkup(React.createElement(IncidentShareCard, { data }));
  assert.ok(svg.includes('Rupture de conducteur') && svg.includes('Câble aluminium x10') && svg.includes('Synchronisation') === false);
  assert.ok(!svg.includes('<image'), 'Share image must work without fetching incident photos');
  fs.mkdirSync(path.join(root, '.local-audit'), { recursive: true });
  const font = fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf')).toString('base64');
  const bold = fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf')).toString('base64');
  const preview = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace('>', `><style>@font-face{font-family:Inter_400Regular;src:url(data:font/ttf;base64,${font})} @font-face{font-family:Inter_700Bold;src:url(data:font/ttf;base64,${bold})} @font-face{font-family:Inter_500Medium;src:url(data:font/ttf;base64,${font})}</style>`);
  fs.writeFileSync(path.join(root, '.local-audit/incident-share-preview.svg'), preview);
  sqlite.close();
  console.log('Incident sharing checks passed: saved-owner scope, offline fields, material quantity, optional sections, safe bitmap bounds, date, cache lifetime, account switch and storage failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
