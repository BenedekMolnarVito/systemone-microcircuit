import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeystore, normalizeKey } from '../../docs/js/jev/keystore.js';

const mockStorage = (throws = false) => {
  const calls = [], data = {};
  const mk = (name) => ({
    getItem: (k) => { calls.push([name, 'get', k]); if (throws) throw new Error('x'); return data[name + k] ?? null; },
    setItem: (k, v) => { calls.push([name, 'set', k]); if (throws) throw new Error('x'); data[name + k] = v; },
    removeItem: (k) => { calls.push([name, 'remove', k]); if (throws) throw new Error('x'); delete data[name + k]; },
  });
  return { session: mk('s'), local: mk('l'), calls, data };
};

test('U-37 normalizeKey', () => {
  assert.deepEqual(normalizeKey('  FAKEkey123456\n'), { ok: true, key: 'FAKEkey123456' });
  assert.equal(normalizeKey('FAKE key 12345').ok, false);
  assert.equal(normalizeKey('FAKE').ok, false);
  assert.equal(normalizeKey('FAKE' + 'x'.repeat(509)).ok, false);
  assert.equal(normalizeKey('FAKE' + 'x'.repeat(508)).ok, true);
  assert.equal(normalizeKey('ключFAKE1234').ok, false);
});

test('U-38 disabled until enable(); storage routing; forget; mask; no leak', () => {
  const st = mockStorage();
  const ks = createKeystore(st);
  assert.deepEqual(ks.set('FAKEkey123456', false), { ok: false, error: 'disabled' });
  assert.equal(st.calls.length, 0);
  assert.equal(ks.enabled, false);
  ks.enable();
  st.calls.length = 0;
  assert.equal(ks.set('FAKEkey123456', false).ok, true);
  assert.ok(st.calls.some((c) => c[0] === 's' && c[1] === 'set'));
  assert.ok(!st.calls.some((c) => c[0] === 'l' && c[1] === 'set'));
  st.calls.length = 0;
  ks.set('FAKEkey123456', true);
  assert.ok(st.calls.some((c) => c[0] === 'l' && c[1] === 'set'));
  assert.ok(!st.calls.some((c) => c[0] === 's' && c[1] === 'set'));
  assert.equal(ks.masked(), '•••• 3456');
  assert.ok(!JSON.stringify(ks).includes('FAKEkey123456'));
  ks.forget();
  assert.equal(ks.get(), null);
  assert.equal(ks.has(), false);
  assert.deepEqual(st.data, {});
});

test('keystore loads from storage on enable, markInvalid cleared by set', () => {
  const st = mockStorage();
  st.session.setItem('smc.jevKey', 'FAKEstored1234');
  const ks = createKeystore(st);
  assert.equal(ks.get(), null);
  ks.enable();
  assert.equal(ks.get(), 'FAKEstored1234');
  ks.markInvalid();
  assert.equal(ks.isInvalid(), true);
  ks.set('FAKEother12345', false);
  assert.equal(ks.isInvalid(), false);
});

test('U-41 throwing storage -> memoryOnly', () => {
  const ks = createKeystore(mockStorage(true));
  ks.enable();
  assert.deepEqual(ks.set('FAKEkey123456', false), { ok: true, memoryOnly: true });
  assert.equal(ks.get(), 'FAKEkey123456');
  ks.forget();
});
