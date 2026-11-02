/* Sync regression tests: executes the current TypeScript against disposable SQLite.
 * Cloud and native media calls are mocked. SQLite runs in memory.
 * Run: node tests/sync-regression.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const evidence = [];
let insertedPayload = null;
const deletedFiles = [];
const cloud = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'user-A' }, access_token: 'test-token' } } }) },
  from() {
    return {
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      insert(payload) { insertedPayload = payload; return this; },
      single: async () => ({ data: { id: 'remote-created-by-current-session' }, error: null }),
    };
  },
  rpc: async () => ({ error: null }),
};
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  let source = fs.readFileSync(filename, 'utf8');
  if (relative.replaceAll('\\', '/') === 'lib/sync.ts') {
    source += '\nexport { processCreateIncident, processAttachMedia, processStatusUpdate, pullIncidents, toRemoteInsert, shouldResetRetryBackoff, shouldDeferOperationUntilIncidentExists };';
  }
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const localRequire = (name) => {
    if (name.endsWith('/supabase')) return { supabase: cloud, isSupabaseNetworkError: () => false };
    if (name.endsWith('/imageUtils')) return { deleteLocalMedia: async (uri) => deletedFiles.push(uri) };
    if (name === 'expo-sqlite') return {};
    if (name === '@supabase/supabase-js') return { createClient: () => cloud };
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${output}\n})`, {
    console, __DEV__: false, Date, Math, Set, Promise,
  }, { filename })(localRequire, module, module.exports);
  return module.exports;
}
function database() {
  const sqlite = new DatabaseSync(':memory:');
  return {
    sqlite,
    execAsync: async (sql) => sqlite.exec(sql),
    runAsync: async (sql, params = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (callback) => {
      sqlite.exec('BEGIN');
      try { await callback(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}
const schema = load('db/index.ts');
const incidents = load('db/incidents.ts');
const operations = load('db/syncOperations.ts');
const sync = load('lib/sync.ts');
const base = {
  client_id: 'client-A', type: 'BT', date: '2026-10-13T10:00:00Z', village: 'Test',
  incident_type: 'Test', commune_id: '12345678-1234-4234-8234-123456789abc',
  equipment_used: '', reclamation: false, created_by: 'user-A',
};
async function check(name, callback) {
  try { evidence.push({ name, ...(await callback()) }); }
  catch (error) { evidence.push({ name, harnessError: error.message }); process.exitCode = 1; }
}
(async () => {
  await check('BT and MT open without materials, including old partial drafts', async () => {
    const creation = fs.readFileSync(path.join(root, 'app/(tabs)/create-incident-new.tsx'), 'utf8');
    assert.ok(!creation.includes('normalizeMaterialRows'));
    assert.ok(!creation.includes('insertIncidentMaterials'));
    for (const type of ['BT', 'MT']) {
      const db = database(); await schema.initDatabase(db);
      const id = await incidents.createIncident(db, {...base, type, depart_hta: type === 'MT' ? 'Test HTA' : null});
      const partial = [{id:'draft-material', materialName:'Cable', quantity:''}];
      await db.runAsync('UPDATE incidents SET material_draft = ? WHERE id = ?', [JSON.stringify(partial), id]);
      const row = await incidents.getIncidentByLocalId(db, id);
      assert.equal(row.status, 'open'); assert.equal(row.no_material_used, 0);
      assert.deepEqual(JSON.parse(row.material_draft), partial);
      assert.equal((await load('db/incidentMaterials.ts').getIncidentMaterialsByLocalId(db,id)).length,0);
      db.sqlite.close();
    }
  });
  await check('Closure boundary requires materials XOR explicit none', async () => {
    const {AdminIncidentClosureSchema: closure} = load('src/core/entities/admin.ts');
    const id = '12345678-1234-4234-8234-123456789abc';
    const row = {client_material_id:'m',material_name:'Cable',quantity:2};
    assert.equal(closure.safeParse({id,materials:[]}).success,false);
    assert.equal(closure.safeParse({id,materials:[],no_material_used:true}).success,true);
    assert.equal(closure.safeParse({id,materials:[row],no_material_used:true}).success,false);
    assert.equal(closure.safeParse({id,materials:[row],no_material_used:false}).success,true);
    assert.equal(closure.safeParse({id,materials:[{...row,quantity:0}]}).success,false);
  });
  await check('Explicit none survives offline closure, upload, retry and fresh-device pull', async () => {
    const originalFrom = cloud.from;
    try {
      for (const type of ['BT','MT']) {
        const db=database(); await schema.initDatabase(db);
        const id=await incidents.createIncident(db,{...base,type});
        const label=load('lib/materials.ts').NO_MATERIAL_USED_LABEL;
        await db.runAsync("UPDATE incidents SET status='closed',no_material_used=1,equipment_used=? WHERE id=?",[label,id]);
        await operations.enqueueStatusUpdate(db,id,'closed');
        const remote={...base,id:'remote-none',type,status:'open',equipment_used:'',no_material_used:false,created_at:base.date};
        await incidents.markIncidentSyncedWithRemoteId(db,id,remote.id);
        await incidents.upsertIncidentsFromServer(db,[remote]);
        assert.equal((await incidents.getIncidentByLocalId(db,id)).no_material_used,1);
        const updates=[];
        cloud.from=()=>({select(){return this;},eq(){return this;},update(value){updates.push(value);Object.assign(remote,value);return this;},single:async()=>({data:remote,error:null})});
        const op=(await operations.getRunnableSyncOperations(db,20,'user-A'))[0];
        await sync.processStatusUpdate(db,op); await sync.processStatusUpdate(db,op);
        assert.equal(updates.length,1); assert.equal(updates[0].no_material_used,true);
        assert.equal(updates[0].equipment_used,label);
        assert.equal((await load('db/incidentMaterials.ts').getIncidentMaterialsByLocalId(db,id)).length,0);
        const fresh=database();await schema.initDatabase(fresh);
        await incidents.upsertIncidentsFromServer(fresh,[remote]);
        assert.equal((await incidents.getIncidents(fresh))[0].no_material_used,1);
        assert.equal((await incidents.getIncidents(fresh))[0].equipment_used,label);
        db.sqlite.close();fresh.sqlite.close();
      }
    } finally {cloud.from=originalFrom;}
  });
  await check('Fresh schema initializes and is repeatable', async () => {
    const db = database(); await schema.initDatabase(db); await schema.initDatabase(db);
    const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    db.sqlite.close(); return { confirmed: true, tables: tables.map(row => row.name) };
  });
  await check('Legacy queue upgrades without losing pending work', async () => {
    const db = database(); await schema.initDatabase(db);
    const id = await incidents.createIncident(db, base);
    db.sqlite.exec(`DROP TABLE sync_operations;
      CREATE TABLE sync_operations (
      id INTEGER PRIMARY KEY, operation_type TEXT, local_incident_id INTEGER,
      remote_incident_id TEXT, payload_json TEXT, status TEXT, attempt_count INTEGER,
      last_error TEXT, created_at TEXT, updated_at TEXT
    )`);
    db.sqlite.prepare(`INSERT INTO sync_operations VALUES (1,'create_incident',?,NULL,'{}','pending',2,'retry','2026-10-13','2026-10-13')`).run(id);
    await schema.initDatabase(db); await schema.initDatabase(db);
    const row = db.sqlite.prepare('SELECT * FROM sync_operations WHERE id=1').get();
    assert.equal(row.status,'pending'); assert.equal(row.attempt_count,2);
    assert.ok(row.operation_key); assert.equal(row.is_terminal,0);
    db.sqlite.close(); return { confirmed: true };
  });
  await check('Queue isolates account work and creation preserves original owner', async () => {
    const db = database(); await schema.initDatabase(db);
    const row = await incidents.createIncident(db, base);
    await operations.enqueueCreateIncident(db, row, base.client_id);
    const runnable = await operations.getRunnableSyncOperations(db, 20, 'user-A');
    assert.equal(runnable.length, 1);
    await sync.processCreateIncident(db, runnable[0]);
    assert.equal(insertedPayload.created_by, 'user-A');
    assert.equal((await operations.getRunnableSyncOperations(db,20,'user-B')).length,0);
    assert.equal((await operations.getRunnableSyncOperations(db)).length,0);
    db.sqlite.close(); return { confirmed: true, originalOwner: base.created_by,
      queueHasUserFilter: true, insertIncludesOriginalOwner: true,
      limitation: 'Cloud is mocked; server trigger assigns auth.uid() in checked-in SQL.' };
  });
  await check('Server pull preserves pending local closure', async () => {
    const db = database(); await schema.initDatabase(db);
    const id = await incidents.createIncident(db, base);
    await incidents.markIncidentSyncedWithRemoteId(db, id, 'remote-A');
    await incidents.updateIncidentStatus(db, id, 'closed');
    await operations.enqueueStatusUpdate(db, id, 'closed', 'event-A');
    await incidents.upsertIncidentsFromServer(db, [{ ...base, id: 'remote-A', status: 'open', created_at: base.date }]);
    const local = await incidents.getIncidentByLocalId(db, id);
    assert.equal(local.status, 'closed'); assert.equal(local.sync_status, 'pending');
    assert.equal((await operations.getRunnableSyncOperations(db, 20, 'user-A')).length, 1);
    db.sqlite.close(); return { confirmed: true, displayedStatus: local.status,
      displayedSyncStatus: local.sync_status, closureOperationStillPending: true };
  });
  await check('A local closure arriving during a pull cannot be overwritten', async () => {
    const db=database(); await schema.initDatabase(db); const id=await incidents.createIncident(db,base);
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A');
    const originalGetAll=db.getAllAsync; let injected=false;
    db.getAllAsync=async(sql,params)=>{
      const result=await originalGetAll(sql,params);
      if(!injected&&sql.includes('SELECT operation_type, payload_json')){
        injected=true;
        await db.runAsync("UPDATE incidents SET status='closed',equipment_used='Cable x5' WHERE id=?",[id]);
        await operations.enqueueStatusUpdate(db,id,'closed','concurrent');
      }
      return result;
    };
    await incidents.upsertIncidentsFromServer(db,[{...base,id:'remote-A',status:'open',created_at:base.date}]);
    const row=await incidents.getIncidentByLocalId(db,id);
    assert.equal(row.status,'closed');assert.equal(row.equipment_used,'Cable x5');
    db.sqlite.close();return {confirmed:true};
  });
  await check('A remote client identity cannot overwrite another account cached incident', async () => {
    const db=database();await schema.initDatabase(db);const id=await incidents.createIncident(db,base);
    await assert.rejects(()=>incidents.upsertIncidentsFromServer(db,[{...base,id:'foreign-remote',created_by:'user-B',status:'open',created_at:base.date}]));
    assert.equal((await incidents.getIncidentByLocalId(db,id)).created_by,'user-A');
    assert.equal((await incidents.getIncidentByLocalId(db,id)).remote_id,null);
    db.sqlite.close();return {confirmed:true};
  });
  await check('Offline closed incident is inserted open before materials and closure', async () => {
    const db = database(); await schema.initDatabase(db);
    const id = await incidents.createIncident(db, base);
    await incidents.updateIncidentStatus(db, id, 'closed');
    const row = await incidents.getIncidentByLocalId(db, id);
    assert.equal(sync.toRemoteInsert(row).status, 'open');
    const trigger = fs.readFileSync(path.join(root, 'supabase/migrations/20260614120000_require_materials_before_closure.sql'), 'utf8');
    assert.ok(trigger.includes("TG_OP = 'INSERT'"));
    db.sqlite.close(); return { confirmed: true, insertStatus: 'open',
      conclusion: 'Checked-in BEFORE INSERT trigger rejects closed rows without existing material rows.',
      limitation: 'PostgreSQL trigger reviewed, not executed against deployed server.' };
  });
  await check('Pending materials and closure preserve the local equipment summary until confirmation', async () => {
    const db=database(); await schema.initDatabase(db);
    const id=await incidents.createIncident(db,{...base,equipment_used:'Cable x5'});
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A');
    await operations.enqueueSyncMaterials(db,id); await operations.enqueueStatusUpdate(db,id,'closed','summary');
    const remote={...base,id:'remote-A',status:'open',equipment_used:'Old summary',created_at:base.date};
    await incidents.upsertIncidentsFromServer(db,[remote]);
    assert.equal((await incidents.getIncidentByLocalId(db,id)).equipment_used,'Cable x5');
    const pending=await operations.getRunnableSyncOperations(db,20,'user-A');
    await operations.markSyncOperationDone(db,pending.find(op=>op.operation_type==='sync_materials').id);
    await incidents.upsertIncidentsFromServer(db,[remote]);
    assert.equal((await incidents.getIncidentByLocalId(db,id)).equipment_used,'Cable x5');
    await operations.markSyncOperationDone(db,pending.find(op=>op.operation_type==='update_incident_status').id);
    await incidents.upsertIncidentsFromServer(db,[remote]);
    assert.equal((await incidents.getIncidentByLocalId(db,id)).equipment_used,'Old summary');
    db.sqlite.close(); return {confirmed:true};
  });
  await check('Closure sends normalized summary and repairs an already-closed retry', async () => {
    const db=database(); await schema.initDatabase(db); const id=await incidents.createIncident(db,base);
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A');
    await load('db/incidentMaterials.ts').insertIncidentMaterials(db,id,[{client_material_id:'m-A',material_name:'Cable',quantity:5}]);
    const originalFrom=cloud.from; let remote; let updates=[];
    cloud.from=()=>{let payload; return {select(){return this;},eq(){return this;},update(value){payload=value;updates.push(value);return this;},
      single:async()=>({data:payload?{id:'remote-A'}:remote,error:null})};};
    try {
      for (const status of ['open','closed']) {
        remote={status,equipment_used:''}; updates=[];
        await sync.processStatusUpdate(db,{local_incident_id:id,payload_json:'{"status":"closed"}'});
        assert.equal(updates.length,1); assert.equal(updates[0].equipment_used,'Cable x5'); assert.equal(updates[0].status,'closed');
      }
      remote={status:'closed',equipment_used:'Cable x5'};updates=[];
      await sync.processStatusUpdate(db,{local_incident_id:id,payload_json:'{"status":"closed"}'});
      assert.equal(updates.length,0);
      await sync.processStatusUpdate(db,{local_incident_id:id,payload_json:'{"status":"open"}'});
      assert.equal(updates[0].status,'open'); assert.equal('equipment_used' in updates[0],false);
    } finally {cloud.from=originalFrom;db.sqlite.close();}
    return {confirmed:true};
  });
  await check('Later material revisions remain runnable after completed sync', async () => {
    const db = database(); await schema.initDatabase(db);
    const id = await incidents.createIncident(db, base);
    await operations.enqueueSyncMaterials(db, id);
    const first = (await operations.getRunnableSyncOperations(db, 20, 'user-A'))[0];
    await operations.markSyncOperationDone(db, first.id);
    await operations.enqueueSyncMaterials(db, id);
    const count = (await operations.getRunnableSyncOperations(db, 20, 'user-A')).length;
    assert.equal(count, 1);
    db.sqlite.close(); return { confirmed: true, runnableAfterNewMaterialsEnqueued: count };
  });
  await check('Media attachment replaces deleted local URI with remote URL', async () => {
    const db = database(); await schema.initDatabase(db);
    const localUri = 'file:///test/photo.jpg';
    const id = await incidents.createIncident(db, { ...base, media_urls: [localUri] });
    await incidents.markIncidentSyncedWithRemoteId(db, id, 'remote-A');
    const url = 'https://example.invalid/photo.jpg';
    await sync.processAttachMedia(db, { local_incident_id: id, remote_incident_id: 'remote-A',
      payload_json: JSON.stringify({ remoteUrl: url, localUri, clientMediaId: 'media-A' }) });
    await incidents.upsertIncidentsFromServer(db, [{ ...base, id: 'remote-A', status: 'open',
      media_urls: [url], created_at: base.date }]);
    const local = await incidents.getIncidentByLocalId(db, id);
    assert.ok(deletedFiles.includes(localUri)); assert.equal(JSON.parse(local.media_urls).includes(localUri), false);
    assert.equal(JSON.parse(local.media_urls).filter(value => value===url).length,1);
    db.sqlite.close(); return { confirmed: true, deletedFileStillReferenced: false };
  });
  await check('Periodic foreground retries preserve backoff; manual retry resets it', async () => {
    const db = database(); await schema.initDatabase(db);
    const id = await incidents.createIncident(db, base);
    await operations.enqueueCreateIncident(db, id, base.client_id);
    const op = (await operations.getRunnableSyncOperations(db, 20, 'user-A'))[0];
    await operations.markSyncOperationRunning(db, op.id);
    await operations.markSyncOperationFailed(db, op.id, 'temporary outage');
    assert.equal((await operations.getRunnableSyncOperations(db, 20, 'user-A')).length, 0);
    assert.equal(sync.shouldResetRetryBackoff('foreground'),false);
    assert.equal(sync.shouldResetRetryBackoff('startup'),false);
    assert.equal(sync.shouldResetRetryBackoff('manual'),true);
    await operations.resetRetryableFailedSyncOperations(db);
    assert.equal((await operations.getRunnableSyncOperations(db, 20, 'user-A')).length, 1);
    db.sqlite.close(); return { confirmed: true, delayedBeforeReset: true, immediatelyRunnableAfterReset: true };
  });

  await check('New material revision survives an in-flight revision completing', async () => {
    const db=database(); await schema.initDatabase(db); const id=await incidents.createIncident(db,base);
    await operations.enqueueSyncMaterials(db,id); const op=(await operations.getRunnableSyncOperations(db,20,'user-A'))[0];
    await operations.markSyncOperationRunning(db,op.id); await operations.enqueueSyncMaterials(db,id);
    await operations.markSyncOperationDone(db,op.id);
    assert.equal((await operations.getRunnableSyncOperations(db,20,'user-A')).length,1);
    db.sqlite.close(); return {confirmed:true};
  });
  await check('Closure waits for unconfirmed materials even when their operation failed', async () => {
    const db=database(); await schema.initDatabase(db); const id=await incidents.createIncident(db,base);
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A');
    await operations.enqueueSyncMaterials(db,id); const material=(await operations.getRunnableSyncOperations(db,20,'user-A'))[0];
    await operations.markSyncOperationFailed(db,material.id,'denied','AUTH_OR_PERMISSION',true);
    await operations.enqueueStatusUpdate(db,id,'closed','closure');
    const status=(await operations.getRunnableSyncOperations(db,20,'user-A'))[0];
    assert.equal(await sync.shouldDeferOperationUntilIncidentExists(db,status),true);
    await operations.markSyncOperationDone(db,material.id);
    assert.equal(await sync.shouldDeferOperationUntilIncidentExists(db,status),false);
    db.sqlite.close(); return {confirmed:true};
  });
  await check('Fresh-device material pull restores rows without overwriting pending edits', async () => {
    const db=database(); await schema.initDatabase(db); const id=await incidents.createIncident(db,base);
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A'); const materialDb=load('db/incidentMaterials.ts');
    const remote={incident_id:'remote-A',client_material_id:'material-A',material_name:'Cable',quantity:2};
    await materialDb.upsertIncidentMaterialsFromServer(db,[remote]);
    assert.equal((await materialDb.getIncidentMaterialsByLocalId(db,id))[0].quantity,2);
    await materialDb.insertIncidentMaterials(db,id,[{client_material_id:'material-A',material_name:'Cable',quantity:5}]);
    await operations.enqueueSyncMaterials(db,id); await materialDb.upsertIncidentMaterialsFromServer(db,[remote]);
    assert.equal((await materialDb.getIncidentMaterialsByLocalId(db,id))[0].quantity,5);
    db.sqlite.close(); return {confirmed:true};
  });
  await check('A material edit arriving during download survives the server upsert', async () => {
    const db=database();await schema.initDatabase(db);const id=await incidents.createIncident(db,base);
    await incidents.markIncidentSyncedWithRemoteId(db,id,'remote-A');
    const materialDb=load('db/incidentMaterials.ts');
    await materialDb.insertIncidentMaterials(db,id,[{client_material_id:'material-A',material_name:'Cable',quantity:2}]);
    const originalGetFirst=db.getFirstAsync;let injected=false;
    db.getFirstAsync=async(sql,params)=>{
      const result=await originalGetFirst(sql,params);
      if(!injected&&sql.includes('SELECT local_incident_id FROM incident_materials')){
        injected=true;
        await materialDb.insertIncidentMaterials(db,id,[{client_material_id:'material-A',material_name:'Cable',quantity:5}]);
        await operations.enqueueSyncMaterials(db,id);
      }
      return result;
    };
    await materialDb.upsertIncidentMaterialsFromServer(db,[{incident_id:'remote-A',client_material_id:'material-A',material_name:'Cable',quantity:2}]);
    assert.equal((await materialDb.getIncidentMaterialsByLocalId(db,id))[0].quantity,5);
    db.sqlite.close();return {confirmed:true};
  });
  await check('Keyset pulls retain timestamp ties and refresh material-only changes for the current owner', async () => {
    const db=database(); await schema.initDatabase(db); const metadata=load('db/syncMetadata.ts');
    const stamp='2026-10-20T10:00:00.000Z';
    const rows=Array.from({length:205},(_,index)=>({...base,id:`remote-${String(index).padStart(4,'0')}`,
      client_id:`client-${index}`,status:'open',created_at:stamp,updated_at:stamp}));
    const materials=Array.from({length:1001},(_,index)=>({id:`material-${String(index).padStart(4,'0')}`,
      incident_id:rows[0].id,client_material_id:`m-${index}`,material_name:'Cable',quantity:2}));
    const foreign=await incidents.createIncident(db,{...base,client_id:'foreign',created_by:'user-B'});
    await incidents.markIncidentSyncedWithRemoteId(db,foreign,'foreign-remote');
    const originalFrom=cloud.from; const requests=[];
    cloud.from=(table)=>{
      const predicates=[]; const orders=[]; let max=Infinity; let cursor=null;
      const request={table,ids:[]};requests.push(request);
      const query={select(){return this;},eq(key,value){predicates.push(row=>row[key]===value);return this;},
        in(key,values){request.ids=values;predicates.push(row=>values.includes(row[key]));return this;},
        gte(key,value){predicates.push(row=>row[key]>=value);return this;},
        gt(key,value){predicates.push(row=>row[key]>value);return this;},
        order(key){orders.push(key);return this;},limit(value){max=value;return this;},
        or(value){cursor=value;return this;},
        then(resolve,reject){
          try {
            let data=(table==='incidents'?rows:materials).filter(row=>predicates.every(test=>test(row)));
            if(cursor){const match=/^updated_at\.gt\.(.*),and\(updated_at\.eq\.(.*),id\.gt\.(.*)\)$/.exec(cursor);
              assert.ok(match,'Composite timestamp/id cursor expected');
              data=data.filter(row=>row.updated_at>match[1]||(row.updated_at===match[2]&&row.id>match[3]));}
            data.sort((a,b)=>{for(const key of orders){const result=a[key].localeCompare(b[key]);if(result)return result;}return 0;});
            resolve({data:data.slice(0,max),error:null});
          }catch(error){reject(error);}
        }};return query;
    };
    try {
      await sync.pullIncidents(db,'user-A',{forcePull:true});
      assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS count FROM incidents WHERE created_by='user-A'")).count,205);
      const first=await db.getFirstAsync('SELECT id FROM incidents WHERE remote_id=?',[rows[0].id]);
      assert.equal((await load('db/incidentMaterials.ts').getIncidentMaterialsByLocalId(db,first.id)).length,1001);
      await sync.pullIncidents(db,'user-A');
      assert.equal((await db.getFirstAsync("SELECT COUNT(*) AS count FROM incidents WHERE created_by='user-A'")).count,205);
      await metadata.setSyncMetadata(db,'incidents:lastPulledAt:user-A','2026-10-20T11:00:00.000Z');
      materials[0].quantity=7;
      await sync.pullIncidents(db,'user-A');
      assert.equal((await db.getFirstAsync("SELECT quantity FROM incident_materials WHERE client_material_id='m-0'")).quantity,7);
      assert.ok(requests.filter(request=>request.table==='incident_materials').every(request=>!request.ids.includes('foreign-remote')));
      assert.equal((await incidents.getIncidentByLocalId(db,foreign)).archived_at,null);
    }finally{cloud.from=originalFrom;db.sqlite.close();}
    return {confirmed:true};
  });
  await check('Closure drafts preserve edits and explicit none, isolate owners and cannot revive after closure', async () => {
    const db=database(); await schema.initDatabase(db);
    const id=await incidents.createIncident(db,base); const drafts=load('db/incidentDrafts.ts');
    const rows=[{id:'draft-1',materialName:'Cable',quantity:''}];
    await db.runAsync('UPDATE incidents SET material_draft=? WHERE id=?',[JSON.stringify(rows),id]);
    assert.equal((await drafts.loadClosureDraft(db,id,'user-A')).choice,'used');
    await drafts.saveClosureDraft(db,id,'user-A',{rows,choice:'none'});
    assert.equal((await drafts.loadClosureDraft(db,id,'user-A')).choice,'none');
    assert.equal((await drafts.loadClosureDraft(db,id,'user-A')).rows[0].materialName,'Cable');
    assert.equal(await drafts.loadClosureDraft(db,id,'user-B'),null);
    await drafts.saveClosureDraft(db,id,'user-B',{rows,choice:'used'});
    assert.equal((await drafts.loadClosureDraft(db,id,'user-A')).choice,'none');
    await db.runAsync("UPDATE incidents SET status='closed',material_draft='[]' WHERE id=?",[id]);
    await drafts.saveClosureDraft(db,id,'user-A',{rows,choice:'used'});
    assert.equal((await incidents.getIncidentByLocalId(db,id)).material_draft,'[]');
    assert.equal(await drafts.loadClosureDraft(db,id,'user-A'),null);
    db.sqlite.close();
  });
  await check('Drafts survive database reads and remain isolated by account', async () => {
    const db=database(); await schema.initDatabase(db); const drafts=load('db/incidentDrafts.ts');
    await drafts.saveIncidentDraft(db,'user-A',{description:'Unfinished field report'});
    assert.equal((await drafts.loadIncidentDraft(db,'user-A')).description,'Unfinished field report');
    assert.equal(await drafts.loadIncidentDraft(db,'user-B'),null);
    await drafts.clearIncidentDraft(db,'user-A'); assert.equal(await drafts.loadIncidentDraft(db,'user-A'),null);
    db.sqlite.close(); return {confirmed:true};
  });
  await check('Report periods use Casablanca midnight including Ramadan offset changes', async () => {
    const dates=load('supabase/functions/_shared/reportDates.ts');
    const winter=dates.reportDateRange('2026-01-01','2026-01-01');
    assert.equal(winter.start,'2025-12-31T23:00:00.000Z'); assert.equal(winter.end,'2026-01-01T23:00:00.000Z');
    const ramadan=dates.reportDateRange('2026-03-01','2026-03-01');
    assert.equal(ramadan.start,'2026-03-01T00:00:00.000Z'); assert.equal(ramadan.end,'2026-03-02T00:00:00.000Z');
    assert.throws(()=>dates.reportDateRange('2026-02-30','2026-03-01'));
    return {confirmed:true};
  });
  for (const item of evidence) console.log(`${item.harnessError ? 'ERROR' : 'PASS'}: ${item.name}${item.error ? ` (${item.error})` : ''}`);
})();
