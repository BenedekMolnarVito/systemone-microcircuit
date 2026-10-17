import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, spikeHazard } from '../../docs/js/core/sim.js';
import { buildNetwork, buildSingleNeuronNetwork } from '../../docs/js/core/network.js';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { makePreset } from '../../docs/js/core/stimuli.js';
import { mulberry32, streamSeed, STREAM } from '../../docs/js/core/rng.js';

const Q = { ...DEFAULTS, sigmaV: 0, attention: 0 };
const harness = (pop = 'L23PV', p = Q) => createSim(buildSingleNeuronNetwork(pop), p, 1, { test: true });
const nrn = (pop, excitatory) => ({ id: pop, pop, k: 0, excitatory, o: excitatory ? 0 : -1, j: -1 });
const syn = (target, comp, w0, dSteps, inhibitory = w0 < 0) => ({ target, comp, w0, dSteps, inhibitory });
const lit = (neurons, trunk, collaterals = neurons.map(() => []), plastic = []) => ({
  N: neurons.length, pops: [], neurons: neurons.map((x, i) => ({ ...x, index: i })), trunk, collaterals, kernels: [], plastic: Int32Array.from(plastic),
});
// first step index (relative) where f() becomes true, after spiking neuron src once at relative step 0
function firstAfter(sim, src, f, max = 10) {
  sim.debug.forceNoul(src, 1); sim.step(); sim.debug.forceNoul(src, 0);
  for (let s = 1; s <= max; s++) { sim.step(); if (f()) return s; }
  return -1;
}
const popRates = (net, sim, ms) => {
  const c = {}, sp = sim.spikesSince(0);
  for (let q = 0; q < sp.length; q += 2) { const pop = net.neurons[sp[q + 1]].pop; c[pop] = (c[pop] || 0) + 1; }
  return Object.fromEntries(net.pops.map((p) => [p.id, (c[p.id] || 0) / p.count / (ms / 1000)]));
};
const run = (p, id, steps, seed = 42) => {
  const net = buildNetwork(p, seed), sim = createSim(net, p, seed);
  sim.setStimulus(makePreset(id, seed), id); sim.stepN(steps);
  return { net, sim };
};
const allFinite = (sim) => ['S', 'Db', 'Da', 'G'].every((k) => sim.state[k].every(Number.isFinite));

test('U-05 leak', () => {
  const sim = harness();
  sim.debug.setState(0, { S: 10 });
  sim.stepN(20);
  assert.ok(Math.abs(sim.state.S[0] - 10 * Math.exp(-1)) < 1e-4, String(sim.state.S[0]));
});

test('U-06 noul sigmoid', () => {
  const lam = Math.exp(-0.5 / DEFAULTS.tauM);
  const noulAt = (S, p = Q) => { const sim = harness('L23PV', p); sim.debug.setState(0, { S: S / lam }); sim.step(); return sim.state.noul[0]; };
  assert.ok(Math.abs(noulAt(15) - 0.5) < 1e-5);
  assert.ok(noulAt(15 + 20) > 0.9999);
  assert.ok(noulAt(15 - 20) < 1e-4);
  const v = noulAt(40, { ...Q, delta: 0.5 });
  assert.ok(Number.isFinite(v) && v === 1);
});

test('U-07 spike hazard', () => {
  assert.ok(Math.abs(spikeHazard(0.5, 0.05) - 0.0340636710751544) < 1e-12);
  assert.equal(spikeHazard(1, 0.05), 1);
  const sim = harness();
  sim.debug.forceNoul(0, 0.5);
  let k = 0;
  for (let s = 0; s < 1e5; s++) { sim.debug.setState(0, { ref: 0 }); k += sim.step().spikes.length; }
  assert.ok(Math.abs(k / 1e5 - 0.03406) < 0.0025, String(k / 1e5));
  sim.debug.forceNoul(0, 1);
  for (let s = 0; s < 50; s++) { sim.debug.setState(0, { ref: 0 }); assert.equal(sim.step().spikes.length, 1); }
  sim.debug.forceNoul(0, 0);
  for (let s = 0; s < 1000; s++) { sim.debug.setState(0, { ref: 0 }); assert.equal(sim.step().spikes.length, 0); }
});

test('U-09 refractory + U-10 reset', () => {
  const sim = harness();
  sim.debug.setState(0, { S: 12 });
  sim.debug.forceNoul(0, 1);
  assert.equal(sim.step().spikes.length, 1);
  assert.equal(sim.state.S[0], DEFAULTS.vReset); // U-10
  for (let s = 0; s < 4; s++) {
    sim.debug.inject(0, 0, 30); sim.debug.inject(0, 2, 30);
    assert.equal(sim.step().spikes.length, 0);
    assert.equal(sim.state.S[0], 0);
  }
  assert.equal(sim.step().spikes.length, 1); // 5th step after spike
});

test('U-11 softmax', () => {
  const rng = mulberry32(7);
  for (const tauC of [0.05, 1, 5]) {
    for (let t = 0; t < 50; t++) {
      const b = [0, 1, 2].map(() => rng() * 100 - 50);
      const net = lit([nrn('L23E', true)], [[]], [b.map((bk, k) => ({ id: ['output', 'recurrent', 'lateral'][k], k, b: bk, gamma: 0, targets: [] }))]);
      const sim = createSim(net, { ...Q, tauC }, 1, { test: true });
      sim.debug.forceNoul(0, 1);
      const p = sim.step().routes[0].p;
      assert.ok(Math.abs(p[0] + p[1] + p[2] - 1) < 1e-6);
    }
  }
  const net = lit([nrn('L23E', true)], [[]], [[{ id: 'output', k: 0, b: 1, gamma: 0, targets: [] }, { id: 'recurrent', k: 1, b: 0, gamma: 0, targets: [] }]]);
  const sim = createSim(net, { ...Q, tauC: 0.05 }, 1, { test: true });
  sim.debug.forceNoul(0, 1);
  assert.ok(sim.step().routes[0].p[0] >= 0.99);
  sim.setParams({ tauC: 0 }); // clamped to 0.05, no NaN
  sim.stepN(5);
  assert.ok(sim.step().routes.every((r) => r.p.every(Number.isFinite)));
});

test('U-12 soft vs hard expectation', () => {
  const total = (routing) => {
    const ids = ['output', 'recurrent', 'lateral'], b = [0, 0.2, -0.2];
    const net = lit([nrn('L23E', true), nrn('L5E', true), nrn('L5E', true), nrn('L5E', true)], [[], [], [], []],
      [ids.map((id, k) => ({ id, k, b: b[k], gamma: 0, targets: [syn(k + 1, 0, 0.001, 3)] })), [], [], []]);
    const sim = createSim(net, { ...Q, routing, tauBasal: 1e12 }, 1, { test: true });
    for (let i = 1; i <= 3; i++) sim.debug.forceNoul(i, 0);
    sim.debug.forceNoul(0, 1);
    let spikes = 0;
    while (spikes < 1e4) spikes += sim.step().spikes.length;
    sim.debug.forceNoul(0, 0); sim.stepN(4); // flush in-flight
    return [1, 2, 3].map((i) => sim.state.Db[i]);
  };
  const h = total('hard'), s = total('soft');
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(h[k] - s[k]) / s[k] < 0.03, `${k}: ${h[k]} vs ${s[k]}`);
});

test('U-13 delays', () => {
  // E synapse: 3 steps
  let sim = createSim(lit([nrn('L23E', true), nrn('L23PV', false)], [[syn(1, 2, 4, 3)], []]), Q, 1, { test: true });
  sim.debug.forceNoul(1, 0);
  assert.equal(firstAfter(sim, 0, () => sim.state.S[1] > 0), 3);
  // I synapse: 2 steps
  sim = createSim(lit([nrn('L23PV', false), nrn('L23SST', false)], [[syn(1, 2, -3, 2)], []]), Q, 1, { test: true });
  sim.debug.forceNoul(1, 0);
  assert.equal(firstAfter(sim, 0, () => sim.state.S[1] < 0), 2);
  assert.ok(Math.abs(sim.state.S[1] + 3) < 1e-6); // -3 * g/4
  // input: pixel 0 spike at step n lands in L4E basal at step n+2 (replicates the input stream)
  const K = new Float32Array(256); K[0] = 1;
  const net = { ...lit([nrn('L4E', true)], [[]]), kernels: [K] };
  sim = createSim(net, { ...Q, pixelNoise: 0, rMax: 200 }, 1, { test: true });
  sim.debug.forceNoul(0, 0);
  sim.setStimulus(new Float32Array(256).fill(1), 'white');
  const rIn = mulberry32(streamSeed(1, STREAM.INPUT));
  const spikeAt = [];
  for (let n = 0; n < 200; n++) { for (let q = 0; q < 256; q++) { const u = rIn(); if (q === 0 && u < 0.1) spikeAt.push(n); } }
  const jumps = [];
  let prev = 0;
  for (let n = 0; n < 200; n++) { sim.step(); const v = sim.state.Db[0]; if (v > prev * Math.exp(-0.05) + 1) jumps.push(n); prev = v; }
  assert.ok(spikeAt.length > 5);
  assert.deepEqual(jumps, spikeAt.filter((n) => n + 2 < 200).map((n) => n + 2));
});

test('U-14 PV divisive halves dendritic drive', () => {
  const drive = (G) => {
    const sim = harness('L23E', { ...Q, tauShunt: 1e12 });
    sim.debug.forceNoul(0, 0);
    sim.debug.setState(0, { G });
    sim.debug.inject(0, 1, 4);
    sim.step();
    return sim.state.S[0];
  };
  assert.ok(drive(0) > 0);
  assert.ok(Math.abs(drive(1) / drive(0) - 0.5) < 1e-5);
  // divisive mode routes PV->E into inShunt, not inSoma
  const net = lit([nrn('L23PV', false), nrn('L23E', true)], [[syn(1, 2, -3, 2)], []]);
  const sim = createSim(net, { ...Q, pvMode: 'divisive' }, 1, { test: true });
  sim.debug.forceNoul(1, 0);
  firstAfter(sim, 0, () => false, 2);
  assert.ok(sim.state.G[1] > 0.29 && sim.state.S[1] > -0.1, `${sim.state.G[1]} ${sim.state.S[1]}`); // no -3 mV somatic hit
});

test('U-15 SST -> apical only; VIP reduces SST', () => {
  const net = lit([nrn('L23VIP', false), nrn('L23SST', false), nrn('L23E', true)], [[syn(1, 2, -6, 2)], [syn(2, 1, -4, 2)], []]);
  let sim = createSim(net, Q, 1, { test: true });
  [0, 2].forEach((i) => sim.debug.forceNoul(i, 0));
  firstAfter(sim, 1, () => false, 2);
  assert.ok(Math.abs(sim.state.Da[2] + 4) < 1e-6);
  assert.equal(sim.state.Db[2], 0);
  sim = createSim(net, Q, 1, { test: true });
  [1, 2].forEach((i) => sim.debug.forceNoul(i, 0));
  firstAfter(sim, 0, () => false, 2);
  assert.ok(Math.abs(sim.state.S[1] + 6) < 1e-6);
});

test('U-16 STDP', () => {
  const mk = () => {
    const net = lit([nrn('L23E', true), nrn('L23E', true)], [[], []],
      [[{ id: 'recurrent', k: 0, b: 0, gamma: 0, targets: [syn(1, 0, 4, 3)] }], []], [0, 0, 0]);
    const sim = createSim(net, { ...Q, stdp: true }, 1, { test: true });
    sim.debug.forceNoul(0, 0); sim.debug.forceNoul(1, 0);
    return sim;
  };
  const fire = (sim, ids) => { ids.forEach((i) => sim.debug.forceNoul(i, 1)); sim.step(); ids.forEach((i) => sim.debug.forceNoul(i, 0)); };
  const w = (sim) => sim.state.weights[0][0][0];
  const decay10 = Math.exp(-10 * 0.5 / 20);
  // pre at t, post at t + 5 ms
  let sim = mk(); fire(sim, [0]); sim.stepN(9); fire(sim, [1]);
  assert.ok(Math.abs(w(sim) - (4 + 0.01 * 8 * decay10)) < 1e-6);
  // post before pre
  sim = mk(); fire(sim, [1]); sim.stepN(9); fire(sim, [0]);
  assert.ok(Math.abs(w(sim) - (4 - 0.0105 * 8 * decay10)) < 1e-6);
  // same-step pair, fresh traces: (a) decay 0, (b) uses pre-(c) traces → no change
  sim = mk(); fire(sim, [0, 1]);
  assert.equal(w(sim), 4);
  // pre at t, then pre+post at t+5 ms: LTP uses xPre = decay10, LTD uses yPost[1] = 0 (increment comes in (c))
  sim = mk(); fire(sim, [0]); sim.stepN(9); fire(sim, [0, 1]);
  assert.ok(Math.abs(w(sim) - (4 + 0.08 * decay10)) < 1e-6);
  // bounds over 1e4 random pairings
  sim = mk();
  const rng = mulberry32(3);
  for (let t = 0; t < 1e4; t++) {
    const ids = [0, 1].filter(() => rng() < 0.3);
    ids.forEach((i) => sim.debug.setState(i, { ref: 0 }));
    fire(sim, ids);
    assert.ok(w(sim) >= 0 && w(sim) <= 8);
  }
  sim.reset();
  assert.equal(w(sim), 4);
});

test('U-31 blank: E pops <= 5 Hz', () => {
  const { net, sim } = run(DEFAULTS, 'blank', 2000);
  const r = popRates(net, sim, 1000);
  for (const p of ['L4E', 'L23E', 'L5E']) assert.ok(r[p] <= 5, `${p} ${r[p]}`);
});

test('U-32 white: L4E <= 10 Hz, no runaway', () => {
  const { net, sim } = run(DEFAULTS, 'white', 2000);
  assert.ok(popRates(net, sim, 1000).L4E <= 10);
  assert.equal(sim.stats.runawayActive, false);
});

test('U-33 tauM = 1 finite', () => {
  assert.ok(allFinite(run({ ...DEFAULTS, tauM: 1 }, 'vbar', 2000).sim));
});

test('U-34 theta extremes', () => {
  const total = (theta) => { const { sim } = run({ ...DEFAULTS, theta }, 'vbar', 2000); assert.ok(allFinite(sim)); return sim.spikesSince(0).length; };
  const t5 = total(5), t15 = total(15), t40 = total(40);
  assert.ok(t5 > t15 && t40 < t15, `${t5} ${t15} ${t40}`);
});

test('U-35 sigmaV = 10 keeps |S| <= 40', () => {
  const net = buildNetwork(DEFAULTS, 42), sim = createSim(net, { ...DEFAULTS, sigmaV: 10 }, 42);
  sim.setStimulus(makePreset('vbar', 42), 'vbar');
  for (let s = 0; s < 2000; s++) { sim.step(); assert.ok(sim.state.S.every((v) => Math.abs(v) <= 40)); }
});

test('U-36 NaN guard', () => {
  const net = buildNetwork(DEFAULTS, 42), sim = createSim(net, DEFAULTS, 42, { test: true });
  sim.debug.setState(3, { S: NaN });
  sim.step();
  assert.ok(allFinite(sim));
  assert.equal(sim.stats.nanResets, 1);
});

test('U-60 runaway guard + recovery', () => {
  // Ruling: SPEC params (theta 5, g 0, sigmaV 10) reach only ~80 Hz mean E (< 150 Hz trigger); tauM 1 added.
  const net = buildNetwork(DEFAULTS, 42), sim = createSim(net, { ...DEFAULTS, theta: 5, g: 0, sigmaV: 10, tauM: 1 }, 42);
  sim.setStimulus(makePreset('vbar', 42), 'vbar');
  sim.stepN(2000);
  assert.ok(sim.stats.dampGain < 1 && sim.stats.runawayActive);
  sim.setParams({ theta: DEFAULTS.theta, g: DEFAULTS.g, sigmaV: DEFAULTS.sigmaV, tauM: DEFAULTS.tauM });
  sim.stepN(20000);
  assert.equal(sim.stats.dampGain, 1);
  assert.equal(sim.stats.runawayActive, false);
});

test('U-61 g rescales inhibitory weights live', () => {
  const net = lit([nrn('L23VIP', false), nrn('L23SST', false)], [[syn(1, 2, -6, 2)], []]);
  const sim = createSim(net, Q, 1, { test: true });
  sim.debug.forceNoul(1, 0);
  firstAfter(sim, 0, () => false, 2);
  const s4 = sim.state.S[1];
  sim.stepN(200);
  const n = sim.n;
  sim.setParams({ g: 8 });
  assert.equal(sim.n, n); // no reset
  const before = sim.state.S[1];
  firstAfter(sim, 0, () => false, 2);
  assert.ok(Math.abs(s4 + 6) < 1e-6);
  assert.ok(Math.abs(sim.state.S[1] - before * Math.exp(-0.15) - 2 * s4) < 1e-4);
  assert.equal(net.trunk[0][0].w0, -6);
});
