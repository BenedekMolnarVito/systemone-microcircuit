import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, gauss, streamSeed } from '../../docs/js/core/rng.js';
import { fnv1a32, fnv1a32Bytes, canonicalJSON, hex8 } from '../../docs/js/core/hash.js';
import { RingBuffer } from '../../docs/js/core/ringbuffer.js';

test('U-01 mulberry32 golden + range', () => {
  const r = mulberry32(42);
  assert.deepEqual([r(), r(), r()], [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  const q = mulberry32(7);
  for (let i = 0; i < 1e5; i++) {
    const u = q();
    assert.ok(u >= 0 && u < 1);
  }
});

test('U-02 gauss moments + draw count', () => {
  const r = mulberry32(1);
  let s = 0, s2 = 0;
  const n = 1e5;
  for (let i = 0; i < n; i++) { const z = gauss(r); s += z; s2 += z * z; }
  const mean = s / n;
  assert.ok(Math.abs(mean) < 0.02, `mean ${mean}`);
  assert.ok(Math.abs(Math.sqrt(s2 / n - mean * mean) - 1) < 0.02);
  let calls = 0;
  gauss(() => { calls++; return 0.5; });
  assert.equal(calls, 2);
});

test('streamSeed = fnv1a32(seed:salt), uint32, seed coerced', () => {
  assert.equal(streamSeed(42, 'noise'), fnv1a32('42:noise'));
  assert.equal(streamSeed(-1, 'x'), fnv1a32('4294967295:x'));
  assert.notEqual(streamSeed(42, 'noise'), streamSeed(42, 'spike'));
});

test('hash helpers', () => {
  assert.equal(fnv1a32(''), 0x811c9dc5);
  assert.equal(fnv1a32('a'), 0xe40c292c);
  assert.equal(fnv1a32Bytes(new TextEncoder().encode('foobar')), 0xbf9cf968);
  assert.equal(hex8(255), '000000ff');
  assert.equal(canonicalJSON({ b: [1, { z: 1, a: undefined, y: 'x' }], a: null }), '{"a":null,"b":[1,{"y":"x","z":1}]}');
});

test('RingBuffer keeps newest, oldest-first', () => {
  const b = new RingBuffer(3);
  [1, 2, 3, 4, 5].forEach((v) => b.push(v));
  assert.equal(b.length, 3);
  assert.deepEqual([...b.toArray()], [3, 4, 5]);
  assert.equal(b.get(0), 3);
  b.clear();
  assert.equal(b.length, 0);
  b.push(9);
  assert.deepEqual([...b.toArray()], [9]);
});
