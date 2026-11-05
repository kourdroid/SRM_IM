/* Native APIs and Supabase are mocked; runs the current client module, not a copy. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const userId = '00000000-0000-4000-8000-000000000001';
const incidentId = '00000000-0000-4000-8000-000000000002';
const notificationId = '00000000-0000-4000-8000-000000000003';

function evaluate(relative, dependencies) {
  const filename = path.join(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected import: ${name}`);
  };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
    console, setTimeout, clearTimeout, AbortController, URL, fetch,
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } },
  }, { filename })(localRequire, module, module.exports);
  return module.exports;
}

function client() {
  const events = [];
  const stored = new Map();
  const platform = { OS: 'android' };
  const state = {
    permission: { status: 'granted', granted: true, canAskAgain: true },
    token: 'ExponentPushToken[new-device]',
    session: { user: { id: userId } },
    channel: { sound: 'custom', importance: 7 },
    registerError: null,
    unregisterError: null,
    onGetToken: null,
    handler: null,
  };
  const native = {
    AndroidImportance: { HIGH: 6, MAX: 7 },
    AndroidNotificationVisibility: { PRIVATE: 2 },
    setNotificationHandler: handler => { state.handler = handler; },
    getPermissionsAsync: async () => { events.push('permission'); return state.permission; },
    requestPermissionsAsync: async () => {
      events.push('prompt');
      state.permission = { status: 'granted', granted: true, canAskAgain: true };
      return state.permission;
    },
    setNotificationChannelAsync: async (_id, channel) => { events.push('channel'); assert.equal(channel.sound, 'intervx_alert.wav'); },
    getNotificationChannelAsync: async () => state.channel,
    getExpoPushTokenAsync: async options => {
      events.push({ getToken: options });
      if (state.onGetToken) await state.onGetToken();
      return { data: state.token };
    },
    dismissAllNotificationsAsync: async () => { events.push('dismiss'); },
    clearLastNotificationResponseAsync: async () => { events.push('clear-response'); },
  };
  const cloud = {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      stopAutoRefresh: () => events.push('stop-refresh'),
      signOut: async () => events.push('sign-out'),
    },
    rpc(name, args) {
      events.push({ rpc: name, args });
      const result = { error: name === 'register_admin_push_token' ? state.registerError : state.unregisterError };
      return { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject), abortSignal() { return this; } };
    },
  };
  const storage = {
    getItemAsync: async key => stored.get(key) ?? null,
    setItemAsync: async (key, value) => stored.set(key, value),
    deleteItemAsync: async key => stored.delete(key),
  };
  const api = evaluate('lib/adminNotifications.ts', {
    'expo-constants': { default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } } },
    'expo-device': { isDevice: true },
    'expo-notifications': native,
    'react-native': { Platform: platform },
    './authStorage': { authStorage: storage },
    './supabase': { supabase: cloud },
  });
  return { api, state, stored, events, platform, cloud, storage };
}

let passed = 0;
async function check(name, run) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}

(async () => {
  await check('Tap targets reject another recipient and malformed identifiers', async () => {
    const { api } = client();
    const data = { recipient_id: userId, incident_id: incidentId, notification_id: notificationId };
    assert.equal(api.parseAdminNotificationTarget(data, null), null);
    assert.equal(api.parseAdminNotificationTarget(data, 'different-user'), null);
    assert.equal(api.parseAdminNotificationTarget({ ...data, incident_id: 'https://example.com' }, userId), null);
    assert.deepEqual({ ...api.parseAdminNotificationTarget(data, userId) }, { incidentId, notificationId });
  });
  await check('Foreground banners and sound require the approved active recipient', async () => {
    const { api, state } = client();
    api.setActiveAdminNotificationUser(userId);
    const request = { request: { content: { data: { recipient_id: userId, incident_id: incidentId, notification_id: notificationId } } } };
    assert.equal((await state.handler.handleNotification(request)).shouldPlaySound, true);
    api.setActiveAdminNotificationUser(null);
    assert.equal((await state.handler.handleNotification(request)).shouldShowBanner, false);
    await assert.rejects(api.registerAdminPushNotifications(), /session administrateur/);
  });
  await check('Web status never touches native notification APIs', async () => {
    const { api, events, platform } = client();
    platform.OS = 'web';
    api.setActiveAdminNotificationUser(userId);
    assert.equal((await api.getAdminNotificationStatus()).supported, false);
    assert.equal((await api.registerAdminPushNotifications()).supported, false);
    assert.equal(events.length, 0);
  });
  await check('Explicit activation creates the Android channel before prompting and persists only after server registration', async () => {
    const { api, state, stored, events } = client();
    api.setActiveAdminNotificationUser(userId);
    state.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    const status = await api.registerAdminPushNotifications();
    assert.ok(events.indexOf('channel') < events.indexOf('prompt'));
    assert.equal(status.registered, true);
    assert.equal(JSON.parse([...stored.values()][0]).token, state.token);
    assert.equal(events.filter(event => event.rpc === 'register_admin_push_token').length, 1);
  });
  await check('Startup refresh never prompts for ungranted permissions', async () => {
    const { api, state, events } = client();
    api.setActiveAdminNotificationUser(userId);
    state.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    assert.equal((await api.syncAdminPushNotifications()).registered, false);
    assert.equal(events.includes('prompt'), false);
    assert.equal(events.some(event => event.rpc === 'register_admin_push_token'), false);
  });
  await check('A session change during device registration cannot register under the new account', async () => {
    const { api, state, events, stored } = client();
    api.setActiveAdminNotificationUser(userId);
    state.onGetToken = () => { api.setActiveAdminNotificationUser('other-account'); };
    await assert.rejects(api.registerAdminPushNotifications(), /session a changé/);
    assert.equal(events.some(event => event.rpc === 'register_admin_push_token'), false);
    assert.equal(stored.size, 0);
  });
  await check('Concurrent activation keeps its explicit permission prompt after a silent refresh', async () => {
    const { api, state, events } = client();
    api.setActiveAdminNotificationUser(userId);
    state.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    const silent = api.syncAdminPushNotifications();
    const explicit = api.registerAdminPushNotifications();
    assert.equal((await silent).registered, false);
    assert.equal((await explicit).registered, true);
    assert.equal(events.filter(event => event === 'prompt').length, 1);
  });
  await check('Push-token rotation forwards the supplied native token instead of recursively fetching it', async () => {
    const { api, events } = client();
    api.setActiveAdminNotificationUser(userId);
    const nativeToken = { type: 'android', data: 'native-token' };
    await api.syncAdminPushNotifications(nativeToken);
    assert.equal(events.find(event => event.getToken).getToken.devicePushToken, nativeToken);
  });
  await check('Failed server registration never persists a successful local registration', async () => {
    const { api, state, stored } = client();
    api.setActiveAdminNotificationUser(userId);
    state.registerError = { message: 'Private token must not appear in UI' };
    await assert.rejects(api.registerAdminPushNotifications(), /Impossible d’enregistrer/);
    assert.equal(stored.size, 0);
  });
  await check('Failed retirement remains durable and is retried on the next refresh', async () => {
    const { api, state, stored, events } = client();
    api.setActiveAdminNotificationUser(userId);
    await api.registerAdminPushNotifications();
    const previousToken = state.token;
    state.token = 'ExponentPushToken[rotated-device]';
    state.unregisterError = { message: 'offline' };
    await assert.rejects(api.syncAdminPushNotifications(), /ancien jeton/);
    assert.ok(JSON.parse([...stored.values()][0]).retiredTokens.includes(previousToken));
    state.unregisterError = null;
    await api.syncAdminPushNotifications();
    assert.equal(events.filter(event => event.rpc === 'unregister_admin_push_token' && event.args.p_token === previousToken).length, 2);
    assert.equal(JSON.parse([...stored.values()][0]).retiredTokens, undefined);
  });
  await check('Offline unregister retains token metadata and still clears displayed notifications', async () => {
    const { api, state, stored, events } = client();
    api.setActiveAdminNotificationUser(userId);
    await api.registerAdminPushNotifications();
    state.unregisterError = { message: 'offline' };
    await assert.rejects(api.unregisterAdminPushNotifications(), /Impossible de désactiver/);
    assert.equal(stored.size, 1);
    assert.ok(events.includes('dismiss'));
    assert.ok(events.includes('clear-response'));
    state.unregisterError = null;
    await api.unregisterAdminPushNotifications();
    assert.equal(stored.size, 0);
  });
  await check('Denied permission removes an existing server registration without prompting again', async () => {
    const { api, state, stored, events } = client();
    api.setActiveAdminNotificationUser(userId);
    await api.registerAdminPushNotifications();
    state.permission = { status: 'denied', granted: false, canAskAgain: false };
    const status = await api.registerAdminPushNotifications();
    assert.equal(status.permission, 'denied');
    assert.equal(status.registered, false);
    assert.equal(stored.size, 0);
    assert.equal(events.includes('prompt'), false);
  });
  await check('Android status reports lowered channel importance and muted sound', async () => {
    const { api, state } = client();
    state.channel = { sound: null, importance: 4 };
    const status = await api.getAdminNotificationStatus();
    assert.equal(status.channelBlocked, true);
    assert.equal(status.soundEnabled, false);
  });
  await check('Session clearing attempts push removal before auth signout and remains available offline', async () => {
    const { cloud, storage, events } = client();
    const module = evaluate('lib/supabase.ts', {
      '@supabase/supabase-js': { createClient: () => cloud },
      'expo-network': { addNetworkStateListener() {} },
      './authStorage': { authStorage: storage },
      'react-native': { AppState: { addEventListener() {} } },
      'react-native-url-polyfill/auto': {},
      './adminNotifications': {
        setActiveAdminNotificationUser: () => events.push('deactivate'),
        unregisterAdminPushNotifications: async () => { events.push('unregister'); throw new Error('offline'); },
      },
    });
    await module.clearLocalSupabaseSession();
    assert.ok(events.indexOf('deactivate') < events.indexOf('unregister'));
    assert.ok(events.indexOf('unregister') < events.indexOf('sign-out'));
  });
  await check('Coordinator registers approved directors and keeps notification taps in their role routes', async () => {
    for (const role of ['admin', 'director', 'field', 'pending-director']) {
      const effects = [], activeUsers = [], routes = [];
      let registrations = 0;
      const response = { actionIdentifier: 'default', notification: { request: { identifier: 'test', content: { data: { recipient_id: userId, incident_id: incidentId, notification_id: notificationId } } } } };
      const coordinator = evaluate('components/AdminNotificationCoordinator.tsx', {
        '@/contexts/AuthContext': { useAuth: () => ({ user: { id: userId }, loading: false, isAdmin: role === 'admin', isDirector: role === 'director' }) },
        '@/lib/adminNotifications': {
          setActiveAdminNotificationUser: id => activeUsers.push(id),
          syncAdminPushNotifications: async () => { registrations += 1; },
          unregisterAdminPushNotifications: async () => {},
          parseAdminNotificationTarget: (_data, id) => id === userId ? { incidentId, notificationId } : null,
        },
        '@/lib/monitoring': { Sentry: { captureMessage() {} } },
        'expo-notifications': { DEFAULT_ACTION_IDENTIFIER: 'default', clearLastNotificationResponseAsync: async () => {} },
        'expo-router': { router: { push: route => routes.push(route) }, useRootNavigationState: () => ({ key: 'root' }) },
        'react': { useEffect: effect => effects.push(effect), useCallback: fn => fn, useState: () => [response, () => {}], useRef: current => ({ current }) },
        'react-native': { Platform: { OS: 'web' } },
      }).default;
      coordinator();
      effects.forEach(effect => effect());
      const eligible = role === 'admin' || role === 'director';
      assert.equal(activeUsers[0], eligible ? userId : null);
      assert.equal(registrations, eligible ? 1 : 0);
      assert.equal(routes.length, eligible ? 1 : 0);
      if (eligible) assert.equal(routes[0].pathname, `/(${role})/incidents`);
    }
  });
  console.log(`${passed} notification client regressions passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
