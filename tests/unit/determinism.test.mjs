import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../../docs/js/core/sim.js';
import { buildNetwork } from '../../docs/js/core/network.js';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { makePreset } from '../../docs/js/core/stimuli.js';
import { mulberry32, streamSeed, STREAM } from '../../docs/js/core/rng.js';
import { fnv1a32Bytes, hex8 } from '../../docs/js/core/hash.js';

const make = (seed, p = DEFAULTS) => {
  const sim = createSim(buildNetwork(p, seed), p, seed);
  sim.setStimulus(makePreset('vbar', seed), 'vbar');
  return sim;
};

test('U-21 same seed → same rasterHash; other seed differs; hash = FR-DET-03', () => {
  const a = make(42), b = make(42), c = make(43);
  a.stepN(2000); b.stepN(2000); c.stepN(2000);
  assert.equal(a.rasterHash(), b.rasterHash());
  assert.notEqual(a.rasterHash(), c.rasterHash());
  const pairs = Uint32Array.from(a.spikesSince(0));
  assert.ok(pairs.length > 0);
  assert.equal(a.rasterHash(), hex8(fnv1a32Bytes(new Uint8Array(pairs.buffer)))); // little-endian host
  a.reset();
  a.stepN(2000);
  assert.equal(a.rasterHash(), b.rasterHash());
});

test('U-22 stream separation', () => {
  const hard = make(42), soft = make(42, { ...DEFAULTS, routing: 'soft' });
  hard.stepN(2000); soft.stepN(2000);
  assert.equal(hard.inputHash(), soft.inputHash());
  const ref = make(42), noisy = make(42);
  ref.stepN(1000);
  const ui = mulberry32(streamSeed(42, STREAM.UI));
  for (let s = 0; s < 1000; s++) {
    if (s < 10) makePreset('noise', 42);
    ui(); ui();
    noisy.step();
  }
  assert.equal(noisy.rasterHash(), ref.rasterHash());
});
