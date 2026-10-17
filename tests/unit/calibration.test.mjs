// SPEC 2.11 calibration acceptance (FR-SIM-13): defaults, autoJev off, rates over sim 200–1200 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { buildNetwork } from '../../docs/js/core/network.js';
import { createSim } from '../../docs/js/core/sim.js';
import { makePreset, PRESET_IDS } from '../../docs/js/core/stimuli.js';
import { localReadout } from '../../docs/js/core/readout.js';

const P = { ...DEFAULTS, autoJev: false };
function setup(preset, seed) {
  const net = buildNetwork(P, seed);
  const sim = createSim(net, P, seed);
  sim.setStimulus(makePreset(preset, seed), preset);
  return { net, sim };
}
// mean rate (Hz) of neurons matching f over steps 400–2399 (200–1200 ms)
function rates(preset, seed) {
  const { net, sim } = setup(preset, seed);
  sim.stepN(2400);
  const cnt = new Float64Array(net.N), sp = sim.spikesSince(400);
  for (let q = 0; q < sp.length; q += 2) cnt[sp[q + 1]]++;
  return (f) => { const ids = net.neurons.filter(f).map((x) => x.index); return ids.reduce((a, i) => a + cnt[i], 0) / ids.length; };
}

test('2.11 vbar: L4E vertical 15–80 Hz, other groups ≤ 0.5× vertical (seed 42)', () => {
  const r = rates('vbar', 42);
  const g = [0, 1, 2, 3].map((o) => r((x) => x.pop === 'L4E' && x.o === o));
  assert.ok(g[0] >= 15 && g[0] <= 80, `vertical ${g[0]}`);
  for (const o of [1, 2, 3]) assert.ok(g[o] <= 0.5 * g[0], `group ${o}: ${g[o]} vs ${g[0]}`);
});

test('2.11 blank: every E population ≤ 5 Hz; white: L4E ≤ 10 Hz (seed 42)', () => {
  const b = rates('blank', 42);
  for (const pop of ['L4E', 'L23E', 'L5E']) assert.ok(b((x) => x.pop === pop) <= 5, pop);
  assert.ok(rates('white', 42)((x) => x.pop === 'L4E') <= 10);
});

test('2.11 local readout correct by 500 ms ≥ 9 of seeds 1–10', () => {
  const want = { vbar: 'vertical', hbar: 'horizontal', diag45: 'diag45', diag135: 'diag135' };
  for (const [pr, label] of Object.entries(want)) {
    let ok = 0;
    for (let s = 1; s <= 10; s++) {
      const { net, sim } = setup(pr, s);
      sim.stepN(1000);
      if (localReadout(sim.routesSince(0), sim.n, net).label === label) ok++;
    }
    assert.ok(ok >= 9, `${pr}: ${ok}/10`);
  }
});

test('2.11 no runaway warning with defaults, every preset, seeds 1–10', () => {
  const bad = [];
  for (const pr of PRESET_IDS) for (let s = 1; s <= 10; s++) {
    const { sim } = setup(pr, s);
    for (let q = 0; q < 2400; q++) { sim.step(); if (sim.stats.runawayActive) { bad.push(`${pr}/${s}`); break; } }
  }
  assert.deepEqual(bad, []);
});
