import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../../docs/js/core/sim.js';
import { buildNetwork } from '../../docs/js/core/network.js';
import { DEFAULTS } from '../../docs/js/core/params.js';
import { makePreset } from '../../docs/js/core/stimuli.js';
import { createScheduler, applyControl } from '../../docs/js/core/scheduler.js';
import { createJevClient } from '../../docs/js/jev/client.js';

function setup(params = DEFAULTS, seed = 42) {
  const network = buildNetwork(params, seed);
  const sim = createSim(network, params, seed);
  sim.setStimulus(makePreset('vbar', seed), 'vbar');
  let stim = 'vbar';
  const client = createJevClient({ getSeed: () => seed });
  const ticks = [], windows = [], answers = [];
  const ask = client.ask;
  client.ask = (kind, req, t) => {
    const r = ask(kind, req, t);
    ticks.push(sim.t); windows.push(req.state.windowMs); answers.push(JSON.stringify(r.response));
    return r;
  };
  const sch = createScheduler({ sim, network, client, getParams: () => params, getStimulusId: () => stim, getLocalLabel: () => 'nothing' });
  // run `steps` steps; changes = [[tMs, id]]
  const run = (steps, changes = []) => {
    const pending = [...changes];
    for (let i = 0; i < steps; i++) {
      while (pending.length && sim.t >= pending[0][0]) {
        const [t, id] = pending.shift();
        stim = id;
        sim.setStimulus(makePreset(id, seed), id);
        sch.onStimulusChange(id, t);
      }
      sim.step();
      sch.afterStep(sim.n - 1);
    }
  };
  return { sim, sch, client, ticks, windows, answers, run };
}

test('U-23 deterministic scheduled run with stimulus change', () => {
  const go = () => { const s = setup(); s.run(4000, [[1000, 'hbar']]); return s; };
  const a = go(), b = go();
  assert.equal(a.sim.rasterHash(), b.sim.rasterHash());
  assert.deepEqual(a.answers, b.answers);
  assert.ok(a.answers.length >= 4);
});

test('U-56 grid ticks every 500 ms; windowMs = time since previous tick', () => {
  const s = setup(); s.run(3000);
  assert.deepEqual(s.ticks, [500, 1000, 1500]);
  assert.deepEqual(s.windows, [500, 500, 500]);
});

test('U-56 change at 1000 -> tick 1050, grid 1500 kept', () => {
  const s = setup(); s.run(3000, [[1000, 'hbar']]);
  assert.deepEqual(s.ticks, [500, 1000, 1050, 1500]);
  assert.equal(s.windows[3], 450);
});

test('U-56 change at 1300 -> tick 1350 replaces grid 1500', () => {
  const s = setup(); s.run(3400, [[1300, 'hbar']]);
  assert.deepEqual(s.ticks, [500, 1000, 1350]);
  assert.equal(s.ticks.includes(1500), false);
});

test('U-56 two changes 100 ms apart -> one change tick', () => {
  const s = setup(); s.run(2800, [[1100, 'hbar'], [1200, 'vbar']]);
  assert.deepEqual(s.ticks.filter((t) => t % 500 !== 0), [1150]);
});

test('U-56 pending change tick moves to latest change + 50', () => {
  const s = setup(); s.run(2800, [[1100, 'hbar'], [1120, 'vbar']]);
  assert.deepEqual(s.ticks.filter((t) => t % 500 !== 0), [1170]);
});

test('U-56 reset clears pending, base and callIndex', () => {
  const s = setup(); s.run(1400, [[1000, 'hbar']]);
  assert.ok(s.client.callIndex > 0);
  s.sch.reset();
  assert.equal(s.client.callIndex, 0);
  assert.equal(s.sch.lastTickMs, 0);
  s.sim.reset();
  s.ticks.length = 0;
  s.run(2000);
  assert.deepEqual(s.ticks, [500, 1000]);
});

test('autoJev off -> no ticks', () => {
  const s = setup({ ...DEFAULTS, autoJev: false }); s.run(2000);
  assert.deepEqual(s.ticks, []);
});

test('U-58 applyControl bounds', () => {
  const on = { jevControl: true };
  const ev = (s) => ({ circuit_evidence: { score: s } });
  assert.equal(applyControl(ev(4), on).betaOutput, 0.5);
  assert.equal(applyControl(ev(0), on).betaOutput, -0.5);
  assert.equal(applyControl(ev(99), on).betaOutput, 0.5);
  assert.ok(Math.abs(applyControl({ circuit_novelty: { noul: 0.2 } }, on).stdpM - 0.7) < 1e-12);
  assert.equal(applyControl({ circuit_novelty: { noul: 5 } }, on).stdpM, 1.5);
  assert.deepEqual(applyControl({ ...ev(4), circuit_novelty: { noul: 1 } }, { jevControl: false }), { betaOutput: 0, stdpM: 1 });
});
