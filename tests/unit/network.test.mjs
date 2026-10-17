import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, buildSingleNeuronNetwork } from '../../docs/js/core/network.js';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { canonicalJSON, fnv1a32 } from '../../docs/js/core/hash.js';

const topoHash = (n) => fnv1a32(canonicalJSON({ t: n.trunk, c: n.collaterals }));

test('U-17 counts, no self, collateral ids', () => {
  const n = buildNetwork(DEFAULTS, 42);
  assert.equal(n.N, 58);
  const counts = Object.fromEntries(n.pops.map((p) => [p.id, p.count]));
  assert.deepEqual(counts, { L4E: 16, L4PV: 4, L23E: 16, L23PV: 4, L23SST: 4, L23VIP: 2, L5E: 8, L5PV: 2, L5SST: 2 });
  assert.equal(n.neurons[57].id, 'L5SST-1');
  assert.equal(n.neurons[25].id, 'L23E-5');
  assert.equal(n.kernels.length, 16);
  n.trunk.forEach((l, i) => l.forEach((s) => assert.notEqual(s.target, i)));
  n.collaterals.forEach((l, i) => l.forEach((c) => c.targets.forEach((s) => assert.notEqual(s.target, i))));
  assert.deepEqual(n.collaterals[20].map((c) => c.id), ['output', 'recurrent', 'lateral']);
  assert.deepEqual(n.collaterals[0].map((c) => c.id), ['ascending', 'recurrent']);
  assert.deepEqual(n.collaterals[46].map((c) => c.id), ['output', 'recurrent']);
  assert.equal(n.collaterals[0][0].targets.length, 4); // L4E group 0 -> L23E group 0, p=1
});

test('U-18 determinism + draw count', () => {
  const a = buildNetwork(DEFAULTS, 42), b = buildNetwork(DEFAULTS, 42), c = buildNetwork(DEFAULTS, 43);
  assert.equal(topoHash(a), topoHash(b));
  assert.notEqual(topoHash(a), topoHash(c));
  // collateral recurrent L4E/L23E 2*16*3, trunk pairs with p<1: 64*5 + 16 + 32 + 16 + 16
  assert.equal(a.topologyDraws, 96 + 320 + 16 + 32 + 16 + 16);
});

test('single neuron harness', () => {
  const n = buildSingleNeuronNetwork('L23PV');
  assert.equal(n.N, 1);
  assert.deepEqual(n.trunk, [[]]);
  assert.equal(n.kernels.length, 0);
  assert.equal(buildSingleNeuronNetwork('L23E').collaterals[0].length, 3);
});
