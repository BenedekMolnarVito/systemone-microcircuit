import { test } from 'node:test';
import { createSim } from '../../docs/js/core/sim.js';
import { buildNetwork } from '../../docs/js/core/network.js';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { makePreset } from '../../docs/js/core/stimuli.js';

test('U-30 bench: 10000 steps, median step time (informational)', (t) => {
  const sim = createSim(buildNetwork(DEFAULTS, 42), DEFAULTS, 42);
  sim.setStimulus(makePreset('vbar', 42), 'vbar');
  const dts = new Float64Array(10000);
  for (let s = 0; s < dts.length; s++) { const t0 = performance.now(); sim.step(); dts[s] = performance.now() - t0; }
  dts.sort();
  t.diagnostic(`median step ${(dts[5000] * 1000).toFixed(1)} us, p99 ${(dts[9900] * 1000).toFixed(1)} us`);
});
