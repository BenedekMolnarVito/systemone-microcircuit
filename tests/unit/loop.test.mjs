import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSteps } from '../../docs/js/core/loop.js';

test('U-51 computeSteps clamps delta to 100 ms and caps at 400', () => {
  assert.deepEqual(computeSteps(0, 250, 1000), { steps: 200, acc: 0, capped: false });
  // speed 1000 * 100 ms = 100 sim ms = 200 steps; acc carry-over kept
  const r = computeSteps(0, 16.7, 100); // 1.67 sim ms -> 3 steps, rest carried
  assert.equal(r.steps, 3);
  assert.ok(Math.abs(r.acc - 0.17) < 1e-9 && !r.capped);
  const c = computeSteps(150, 100, 1000); // 250 sim ms -> 500 steps -> capped
  assert.deepEqual(c, { steps: 400, acc: 0, capped: true });
});
