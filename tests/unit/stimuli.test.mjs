import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_IDS, makePreset, rasterize, effectiveIntensity } from '../../docs/js/core/stimuli.js';
import { rates } from '../../docs/js/core/encoding.js';

test('U-08 rasterize', () => {
  const w = 192, h = 192;
  const white = new Uint8ClampedArray(w * h * 4).fill(255);
  const a = rasterize(white, w, h);
  assert.equal(a.length, 256);
  assert.equal(a.reduce((s, v) => s + v, 0), 256);
  const half = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y < h / 2) { const i = (y * w + x) * 4; half[i] = half[i + 1] = half[i + 2] = 0; }
  const b = rasterize(half, w, h);
  assert.equal(b.filter((v) => v === 1).length, 128);
  assert.equal(b.length, 256);
});

test('U-62 presets, effectiveIntensity, rates', () => {
  assert.equal(PRESET_IDS.length, 11);
  for (const id of PRESET_IDS) {
    const img = makePreset(id, 42);
    assert.equal(img.length, 256);
    assert.ok(img.every((v) => v >= 0 && v <= 1));
  }
  assert.equal(makePreset('blank', 1).reduce((s, v) => s + v, 0), 0);
  assert.equal(makePreset('white', 1).reduce((s, v) => s + v, 0), 256);
  assert.equal(makePreset('vbar', 1).reduce((s, v) => s + v, 0), 24);
  assert.deepEqual(makePreset('noise', 7), makePreset('noise', 7));
  assert.notDeepEqual(makePreset('noise', 7), makePreset('noise', 8));
  const img = makePreset('digit7', 1), z = new Float32Array(256).fill(3);
  assert.deepEqual(effectiveIntensity(img, 1, 0, z), img);
  assert.ok(effectiveIntensity(img, 1, 0.5, z).every((v) => v >= 0 && v <= 1));
  const r = rates(Float32Array.of(0, 1), 2, 80);
  assert.deepEqual([...r], [2, 80]);
});
