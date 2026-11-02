const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const calls = [];
let result = { data: [], error: null, count: 3 };
const query = new Proxy({}, { get(_, name) {
  if (name === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return (...args) => { calls.push([name, ...args]); return query; };
} });
const cloud = { from: (...args) => { calls.push(['from', ...args]); return query; }, rpc: (...args) => { calls.push(['rpc', ...args]); return Promise.resolve(result); } };
const moduleObject = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/core/services/adminNotificationService.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console })
  (name => name.endsWith('/supabase') ? { supabase: cloud } : require(name), moduleObject, moduleObject.exports);
const service = moduleObject.exports;
const id = '1579b722-790d-440c-85d8-bbc2c0039a1c';
(async () => {
  result = { data: [{ id, recipient_id: id, incident_id: id, created_at: '2026-10-26T10:00:00+00:00', acknowledged_at: null, incidents: null }], error: null };
  const rows = await service.listAdminNotifications();
  assert.equal(rows[0].incidents, null, 'A nullable incident embed must still parse');
  await service.listAdminNotifications(rows[0]);
  assert.ok(calls.some(call => call[0] === 'or' && call[1].includes(`id.lt.${id}`)), 'Cursor must preserve ties');
  const before = calls.length;
  await assert.rejects(service.listAdminNotifications({ id: 'injected),or(id.gt.0', created_at: 'bad' }));
  assert.ok(!calls.slice(before).some(call => call[0] === 'or'), 'Invalid cursor must never reach the query filter');
  await assert.rejects(service.acknowledgeAdminNotification('invalid'));
  result = { error: { message: 'Forbidden' } };
  await assert.rejects(service.acknowledgeAdminNotification(id), /prise en compte/);
  await assert.rejects(service.listAdminNotifications(), /connexion/);
  result = { error: null, count: 7 };
  assert.equal(await service.countUnreadAdminNotifications(), 7);
  console.log('7 notification inbox checks passed (nullable incidents, tied cursor, invalid cursor/id, ack/read failure, unread count).');
})().catch(error => { console.error(error); process.exitCode = 1; });
