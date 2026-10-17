import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..', '..');
const DOCS = join(ROOT, 'docs');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const jsFiles = () => walk(join(DOCS, 'js')).filter((f) => f.endsWith('.js'));
const rel = (f) => relative(ROOT, f).replaceAll('\\', '/');

// literal-only string argument: 'x', "x" or `x` without ${}
const LITERAL = /^(?:'[^'\\\n]*'|"[^"\\\n]*"|`[^`$\\]*`)\s*;?$/;

test('U-50 no HTML injection sinks with non-literal arguments', () => {
  const bad = [];
  for (const f of jsFiles()) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\.(?:innerHTML|outerHTML)\s*=(?!=)\s*([^\n]*)/g)) {
      if (!LITERAL.test(m[1].trim())) bad.push(`${rel(f)}: ${m[0].trim()}`);
    }
    for (const m of src.matchAll(/insertAdjacentHTML\(\s*[^,)]+,\s*([^)]*)\)/g)) {
      if (!LITERAL.test(m[1].trim())) bad.push(`${rel(f)}: ${m[0].trim()}`);
    }
    for (const m of src.matchAll(/document\.write(?:ln)?\(\s*([^)]*)\)/g)) {
      if (!LITERAL.test(m[1].trim())) bad.push(`${rel(f)}: ${m[0].trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('U-50 no bare-specifier imports in docs/js (FR-ARCH-03)', () => {
  const bad = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\1/g;
  for (const f of jsFiles()) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) {
      if (!/^\.{1,2}\//.test(m[2])) bad.push(`${rel(f)}: ${m[2]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('U-50 index.html loads nothing from http(s) (FR-ARCH-04) and has CSP (FR-ARCH-05)', () => {
  const html = readFileSync(join(DOCS, 'index.html'), 'utf8');
  assert.deepEqual(html.match(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']*/gi) ?? [], []);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'no inline scripts');
  assert.doesNotMatch(html, /\sstyle\s*=/i, 'no inline style attributes');
});

// Section 5.2 exports for DOM-free modules (checked only when the file exists)
const EXPORTS = {
  'docs/js/core/rng.js': ['mulberry32', 'streamSeed', 'gauss', 'STREAM'],
  'docs/js/core/hash.js': ['fnv1a32', 'fnv1a32Bytes', 'canonicalJSON', 'hex8'],
  'docs/js/core/params.js': ['DEFAULTS', 'PARAM_SPECS', 'clampParams', 'derive', 'parseSeed'],
  'docs/js/core/ringbuffer.js': ['RingBuffer'],
  'docs/js/core/loop.js': ['computeSteps'],
  'docs/js/core/stimuli.js': ['PRESET_IDS', 'makePreset', 'rasterize', 'effectiveIntensity'],
  'docs/js/core/encoding.js': ['rates', 'makeKernel'],
  'docs/js/core/network.js': ['buildNetwork', 'buildSingleNeuronNetwork'],
  'docs/js/core/sim.js': ['createSim', 'spikeHazard'],
  'docs/js/core/readout.js': ['localReadout', 'agree'],
  'docs/js/core/scheduler.js': ['createScheduler', 'applyControl'],
  'docs/js/jev/schema.js': ['circuitRequest', 'neuronRequest', 'validateResponse', 'validateRequest'],
  'docs/js/jev/summary.js': ['summarizeCircuit', 'summarizeNeuron'],
  'docs/js/jev/emulator.js': ['emulate'],
  'docs/js/jev/replay.js': ['validateRecording', 'matchKey', 'findMatch', 'buildRecordingEntry', 'buildRecording', 'serializeLogEntry'],
  'docs/js/jev/keystore.js': ['createKeystore', 'normalizeKey'],
  'docs/js/jev/client.js': ['createJevClient', 'classifyError'],
  'docs/js/ui/about-content.js': ['ABOUT'],
};

for (const [file, names] of Object.entries(EXPORTS)) {
  test(`U-50 ${file} imports without a DOM and exports ${names.length} name(s)`, async (t) => {
    if (!existsSync(join(ROOT, file))) return t.skip('file not created yet');
    const mod = await import(pathToFileURL(join(ROOT, file)).href);
    for (const n of names) assert.ok(n in mod, `missing export ${n}`);
  });
}

// T20 enables this (FR-ARCH-01).
test('U-50 Section 5.1 file tree complete', { skip: 'enabled by T20' }, () => {
  const required = [
    'docs/index.html', 'docs/.nojekyll', 'docs/SPEC.md', 'docs/data/jev-recording.json', 'docs/js/boot.js', 'docs/js/main.js',
    ...['tokens', 'base', 'header', 'circuit', 'dashboard', 'panels', 'dialogs'].map((c) => `docs/css/${c}.css`),
    ...Object.keys(EXPORTS),
    ...['store', 'bus', 'header', 'banner', 'input-panel', 'params-panel', 'circuit-view', 'charts', 'dashboard', 'jev-log', 'key-modal', 'about', 'theme', 'keyboard']
      .map((m) => `docs/js/ui/${m}.js`),
    'tools/jev-proxy.mjs', 'tools/cf-worker.js', 'tests/fixtures/recording.json', 'tests/EVIDENCE.md',
    '.gitignore', 'package.json', 'package-lock.json', 'playwright.config.mjs', 'README.md', 'CLAUDE.md',
  ];
  assert.deepEqual(required.filter((f) => !existsSync(join(ROOT, f))), []);
});
