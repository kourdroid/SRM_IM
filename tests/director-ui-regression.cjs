const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let role = 'director';
let selectedIncident = null;
const navigations = [];
let controls = [];
const component = name => props => {
  if (props.onPress) controls.push(props);
  const { children, title, label, description, subtitle, kicker, rightSlot, ListHeaderComponent, data, renderItem } = props;
  return React.createElement(name.toLowerCase(), null, kicker, title, subtitle, label, description, rightSlot, ListHeaderComponent,
    data?.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item }))), children);
};
const native = new Proxy({
  Platform: { OS: 'web', select: options => options.web ?? options.default ?? {} },
  StyleSheet: { create: styles => styles },
}, { get: (target, name) => target[name] ?? component(name) });
function load(relative, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  let nullState = 0;
  const hooks = { ...React, useEffect() {}, useCallback: fn => fn,
    useState(initial) {
      if (initial === true) return [false, () => {}];
      if (relative.endsWith('NotificationsScreen.tsx') && Array.isArray(initial)) return [[{ id: 'notification', incident_id: 'incident', created_at: '2026-11-01T12:00:00Z', incidents: { type: 'BT' } }], () => {}];
      if (initial === null) {
        nullState += 1;
        const incidentSlot = relative.endsWith('DashboardScreen.tsx') ? 3 : 1;
        if (nullState === incidentSlot) return [selectedIncident, () => {}];
      }
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
  };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return native;
    if (name === '@/contexts/AuthContext') return { useAuth: () => ({ role, isAdmin: role === 'admin', isApproved: true, user: { email: 'test@example.com' } }) };
    if (name === 'expo-router') return { router: { push: target => navigations.push(target), replace: target => navigations.push(target) }, useFocusEffect() {}, useLocalSearchParams: () => ({}) };
    if (name === '@expo/vector-icons') return { Ionicons: component('Icon') };
    if (name === '@shopify/flash-list') return { FlashList: component('List') };
    if (name === 'expo-image') return { Image: component('Image') };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: component('SafeArea') };
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { version: 'test' } } };
    if (name.startsWith('@/src/core/services/') || name.startsWith('@/lib/')) return {};
    if (name === '@/components/ui/srm') return new Proxy({}, { get: (_, key) => component(key) });
    if (name.includes('CustomBarChart') || name.includes('MaterialUsageSelector')) return { __esModule: true, default: component('Widget') };
    if (name.startsWith('@/')) {
      const relativePath = name.slice(2);
      return load(relativePath + (fs.existsSync(path.resolve(__dirname, '..', relativePath + '.tsx')) ? '.tsx' : '.ts'), cache);
    }
    if (name === '@react-native-picker/picker') return { Picker: Object.assign(component('Picker'), { Item: component('Item') }) };
    if (name === 'expo-notifications') return {};
    return require(name);
  };
  // Material rows are initialized even when editing is unavailable.
  const requireWithMaterials = name => name === '@/lib/materials'
    ? { createEmptyMaterialFormRow: () => ({}), normalizeMaterialRows: () => [] }
    : localRequire(name);
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console, Date, Intl, Set }, { filename })
    (requireWithMaterials, module, module.exports);
  cache.set(filename, module.exports);
  return module.exports;
}
for (const currentRole of ['director', 'admin']) {
  role = currentRole;
  selectedIncident = null;
  controls = [];
  const Profile = load('components/screens/SupervisionProfileScreen.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Profile));
  assert.equal(html.includes('Utilisateurs'), role === 'admin', 'Director settings must not offer user management');
  assert.equal(html.includes('Référentiels terrain'), role === 'admin', 'Director settings must not offer reference editing');
  controls.find(control => control.title === 'Notifications').onPress();
  assert.equal(navigations.pop(), `/(${role})/notifications`);
  controls = [];
  const Notifications = load('components/screens/SupervisionNotificationsScreen.tsx').default;
  renderToStaticMarkup(React.createElement(Notifications));
  controls.find(control => control.label === 'Voir l’incident').onPress();
  const target = navigations.pop();
  assert.equal(target.pathname, `/(${role})/incidents`);
  assert.equal(target.params.notificationId, 'notification');
  controls.find(control => control.accessibilityLabel === 'Retour aux paramètres').onPress();
  assert.equal(navigations.pop(), `/(${role})/profile`);
}

const incident = { id: 'incident', status: 'open', type: 'BT', created_at: '2026-11-01T12:00:00Z', materials: [] };
for (const screen of ['Dashboard', 'Incidents']) {
  for (const currentRole of ['director', 'admin']) {
    role = currentRole;
    selectedIncident = incident;
    const Screen = load(`components/screens/Supervision${screen}Screen.tsx`).default;
    const html = renderToStaticMarkup(React.createElement(Screen));
    assert.equal(html.includes('Clôturer'), role === 'admin', `${screen}: only admins can close incidents`);
    if (screen === 'Incidents') assert.equal(html.includes('Supprimer'), role === 'admin', 'Only admins can archive incidents');
    assert.ok(!html.includes('LECTURE SEULE'));
    if (role === 'director' && screen === 'Dashboard') assert.ok(html.includes('Administrateur'));
  }
}
for (const screen of ['dashboard', 'incidents', 'reports', 'notifications', 'profile']) {
  const cache = new Map();
  assert.equal(load(`app/(director)/${screen}.tsx`, cache).default, load(`app/(admin)/${screen}.tsx`, cache).default, `${screen} must use the same component for both roles`);
}
console.log('Director UI checks passed: shared screens, administrator header, restricted mutation/settings controls, and role-correct notification links.');
