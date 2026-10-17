import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localReadout, agree } from '../../docs/js/core/readout.js';

test('U-59 agree', () => {
  assert.equal(agree('vertical', 'vertical'), true);
  assert.equal(agree('vertical', 'none'), false);
  assert.equal(agree('nothing', 'none'), true);
  assert.equal(agree('uncertain', 'none'), true);
  assert.equal(agree('vertical', null), null);
});

test('FR-RO-01 localReadout labels, window, soft counts', () => {
  // two L5E neurons per group o=0..3 at index 0..7; collateral 0 = output
  const neurons = Array.from({ length: 8 }, (_, i) => ({ pop: 'L5E', o: i >> 1 }));
  const collaterals = neurons.map(() => [{ id: 'output' }, { id: 'recurrent' }]);
  const net = { neurons, collaterals };
  const r = (n, src, k, p0 = 1) => ({ n, src, k, p: Float32Array.of(p0, 1 - p0) });
  const log = [r(10, 2, 0), ...[0, 1, 2, 3, 4].map((q) => r(500 + q, 2, 0)), r(505, 0, 0), r(506, 0, 1), r(507, 3, 0)];
  assert.deepEqual(localReadout(log, 600, net), { label: 'horizontal', counts: [1, 6, 0, 0], probs: [1 / 7, 6 / 7, 0, 0] });
  assert.equal(localReadout(log.slice(0, 4), 600, net).label, 'nothing');
  assert.equal(localReadout([...log, ...[0, 1, 2, 3].map((q) => r(510 + q, 1, 0))], 600, net).label, 'uncertain');
  assert.deepEqual(localReadout([r(500, 0, 1, 0.25)], 600, net, 200, 'soft').counts, [0.25, 0, 0, 0]);
  assert.deepEqual(localReadout([], 600, net).probs, [0, 0, 0, 0]);
});
