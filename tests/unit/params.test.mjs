import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PARAM_SPECS, clampParams, derive, parseSeed } from '../../docs/js/core/params.js';

test('U-03 parseSeed', () => {
  for (const [s, n] of [['0', 0], ['4294967295', 4294967295], [' 7 ', 7]]) {
    assert.deepEqual(parseSeed(s), { ok: true, seed: n });
  }
  for (const s of ['-1', '4294967296', 'abc', '1e3', '']) {
    const r = parseSeed(s);
    assert.equal(r.ok, false);
    assert.ok(r.error);
  }
});

test('U-04 clampParams', () => {
  assert.equal(clampParams({ tauM: 0 }).tauM, 1);
  assert.equal(clampParams({ tauC: 0 }).tauC, 0.05);
  assert.equal(clampParams({ theta: 99 }).theta, 40);
  assert.deepEqual(clampParams({ nope: 1, tauM: 5 }), { tauM: 5 });
});

test('clampParams: fixed keys, options, booleans, non-finite', () => {
  assert.deepEqual(clampParams({ tRef: 3 }), {});
  assert.deepEqual(clampParams({ tRef: 3 }, { allowFixed: true }), { tRef: 3 });
  assert.deepEqual(clampParams({ routing: 'x', pvMode: 'both', speed: 7, stdp: 1 }), { pvMode: 'both' });
  assert.deepEqual(clampParams({ speed: 250, stdp: true }), { speed: 250, stdp: true });
  assert.deepEqual(clampParams({ tauM: NaN, sigmaV: Infinity, seed: 4294967296.7 }), { seed: 4294967295 });
});

test('DEFAULTS/PARAM_SPECS consistent, frozen', () => {
  assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(PARAM_SPECS));
  assert.deepEqual(Object.keys(DEFAULTS), Object.keys(PARAM_SPECS));
  assert.equal(Object.keys(DEFAULTS).length, 42);
  for (const [k, s] of Object.entries(PARAM_SPECS)) {
    assert.ok(s.symbol && s.unit && s.source && s.tag, k);
    if ('min' in s) assert.ok(DEFAULTS[k] >= s.min && DEFAULTS[k] <= s.max, k);
  }
  assert.equal(PARAM_SPECS.theta.step, 0.5);
  assert.equal(PARAM_SPECS.budget.step, 1);
});

test('derive: Section 2.3 derived constants', () => {
  const d = derive(DEFAULTS);
  assert.equal(d.refSteps, 4);
  assert.equal(d.noulExp, 0.05);
  assert.deepEqual([d.dExcSteps, d.dInhSteps, d.dInputSteps], [3, 2, 2]);
  assert.ok(Math.abs(d.lamM - Math.exp(-0.05)) < 1e-15);
});
