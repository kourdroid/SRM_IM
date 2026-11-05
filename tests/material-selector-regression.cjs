const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/MaterialUsageSelector.tsx'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const mod = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${output}\n})`, {})(name => {
  if (name === 'react-native') return { Text: 'Text', TouchableOpacity: 'Button', View: 'View' };
  if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
  return require(name);
}, mod, mod.exports);

for (const value of [null, 'used', 'none']) {
  const changes = [];
  const tree = mod.exports.default({ value, onChange: choice => changes.push(choice) });
  assert.equal(tree.props.accessibilityRole, 'radiogroup');
  const buttons = tree.props.children;
  assert.equal(buttons.length, 2);
  assert.equal(buttons.filter(button => button.props.accessibilityState.checked).length, value === null ? 0 : 1);
  buttons.forEach((button, index) => {
    assert.equal(button.props.accessibilityRole, 'radio');
    assert.ok(button.props.style.minHeight >= 48);
    assert.equal(button.props.children[1].props.children, index === 0 ? 'Avec matériel' : 'Aucun matériel utilisé');
    button.props.onPress();
  });
  assert.deepEqual(changes, ['used', 'none']);
}
const disabled = mod.exports.default({ value: 'none', onChange() {}, disabled: true });
assert.ok(disabled.props.children.every(button => button.props.disabled && button.props.accessibilityState.disabled));
console.log('PASS: Material selector has explicit choices, no default, accessible radio states and disabled controls');
