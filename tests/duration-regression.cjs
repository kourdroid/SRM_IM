const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/core/utils/duration.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module_ = { exports: {} };
vm.runInThisContext(`(function(module,exports){${source}\n})`)(module_, module_.exports);
const { durationPartsFromDays, durationPartsFromMinutes, formatDurationBetween } = module_.exports;

const text = parts => parts.map(part => `${part.value}${part.unit ? ` ${part.unit}` : ''}`).join(' ');
const cases = [
  [0.2, '< 1 min'],
  [45, '45 min'],
  [59.6, '1 h'],
  [60, '1 h'],
  [144, '2 h 24 min'],
  [599, '9 h 59 min'],
  [600, '10 h'],
  [47 * 60, '47 h'],
  [48 * 60, '2 j'],
  [76 * 60, '3 j 4 h'],
  [3 * 1440 - 10, '3 j'],
  [-5, '—'],
  [NaN, '—'],
];
for (const [minutes, expected] of cases) assert.equal(text(durationPartsFromMinutes(minutes)), expected, `${minutes} min`);

assert.equal(text(durationPartsFromDays(0)), '—', 'no closed incident shows no data');
assert.equal(text(durationPartsFromDays(0.1)), '2 h 24 min', 'the value that used to read 0.1 day');
assert.equal(formatDurationBetween('2026-11-01T10:00:00Z', '2026-11-01T12:30:00Z'), '2 h 30 min');
assert.equal(formatDurationBetween('bad', 'date'), 'Durée inconnue');

console.log('Duration checks passed: hours by default, minutes below one hour, days from 48 hours.');
