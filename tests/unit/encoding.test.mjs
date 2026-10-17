import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKernel } from '../../docs/js/core/encoding.js';
import { makePreset } from '../../docs/js/core/stimuli.js';

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const OFFS = [-3, -1, 1, 3];

test('U-19 kernels zero-mean normalised', () => {
  for (let o = 0; o < 4; o++) for (const d of OFFS) {
    const k = makeKernel(o, d);
    assert.equal(k.length, 256);
    let pos = 0, neg = 0;
    for (const v of k) v > 0 ? (pos += v) : (neg += v);
    assert.ok(Math.abs(pos - 1) < 1e-5 && Math.abs(neg + 1) < 1e-5);
    assert.ok(Math.abs(dot(k, new Float32Array(256).fill(1))) < 1e-5);
  }
});

test('U-20 vertical kernel prefers vbar', () => {
  const k = makeKernel(0, 1);
  assert.ok(dot(k, makePreset('vbar', 1)) > 3 * dot(k, makePreset('hbar', 1)));
});
