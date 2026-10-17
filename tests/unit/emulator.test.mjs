import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emulate } from '../../docs/js/jev/emulator.js';
import { circuitRequest, neuronRequest, validateResponse, ORIENTATIONS } from '../../docs/js/jev/schema.js';
import { mulberry32 } from '../../docs/js/core/rng.js';

const EXAMPLE = {
  kind: 'circuit_summary',
  description: 'Rates of a 58-neuron model visual cortex column over the last window.',
  simTimeMs: 1500.0, windowMs: 500.0, stimulus: 'vbar',
  l4_rates_hz: { vertical: 34.5, horizontal: 2.1, diag45: 6.0, diag135: 5.2 },
  l23_rates_hz: { vertical: 28.0, horizontal: 1.2, diag45: 3.9, diag135: 3.1 },
  l5_rates_hz: { vertical: 19.5, horizontal: 0.0, diag45: 2.5, diag135: 0.0 },
  inhibitory_rates_hz: { pv: 22.1, sst: 9.8, vip: 7.5 },
  prev_l4_rates_hz: { vertical: 1.0, horizontal: 0.8, diag45: 1.1, diag135: 0.9 },
  local_readout: 'vertical',
};
const withRates = (v, h, d1, d2) => circuitRequest({ ...EXAMPLE, l4_rates_hz: { vertical: v, horizontal: h, diag45: d1, diag135: d2 } });
const dec = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('U-24 circuit response shape', () => {
  const req = circuitRequest(EXAMPLE);
  const res = emulate(req, { seed: 1, callIndex: 0 });
  assert.deepEqual(Object.keys(res).sort(), ['answers', 'model', 'usage']);
  assert.equal(res.model, 'jev-sim');
  assert.equal(res.usage.input_tokens, Math.ceil(JSON.stringify(req).length / 4));
  assert.equal(res.usage.output_tokens, 60);
  for (const [k, q] of Object.entries(req.questions)) {
    const a = res.answers[k];
    assert.equal(a.type, q.type);
    if (a.probabilities) {
      assert.equal(Math.round(sum(a.probabilities) * 100), 100);
      assert.ok(Object.values(a.probabilities).every(dec));
    }
    for (const x of [a.noul, a.score, a.confidence]) if (x !== undefined) assert.ok(dec(x));
  }
});

test('U-25 emulator output passes validateResponse for 1000 random summaries', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const rate = () => Math.round(rng() * 600) / 10;
    const req = i % 2
      ? withRates(rate(), rate(), rate(), rate())
      : neuronRequest({ kind: 'neuron_summary', neuron: ['L4E-1', 'L23E-5', 'L5E-3', 'L23PV-0'][i % 4 >> 0], soma_mv: rate() - 20, threshold_mv: 15, apical_mv: rate() / 3, collaterals: i % 4 === 3 ? [] : [{ id: 'output' }, { id: 'recurrent' }, { id: 'lateral' }] });
    const v = validateResponse(req, emulate(req, { seed: i, callIndex: i }));
    assert.ok(v.ok, v.reason);
  }
});

test('U-26 deterministic; callIndex changes jitter', () => {
  const req = circuitRequest(EXAMPLE);
  assert.deepEqual(emulate(req, { seed: 5, callIndex: 3 }), emulate(req, { seed: 5, callIndex: 3 }));
  const f = (c) => JSON.stringify(emulate(req, { seed: 5, callIndex: c }).answers.circuit_orientation.probabilities);
  const a = f(0);
  const b = [1, 2, 3, 4, 5].map(f);
  assert.ok(b.some((x) => x !== a));
});

test('U-26b golden: seed 42, callIndex 0, 3.4.1 example', () => {
  const golden = JSON.parse(readFileSync(new URL('../fixtures/emulator-golden.json', import.meta.url), 'utf8'));
  assert.deepEqual(emulate(circuitRequest(EXAMPLE), { seed: 42, callIndex: 0 }), golden);
});

test('U-27 orientation choice', () => {
  const ori = (...r) => emulate(withRates(...r), { seed: 1, callIndex: 0 }).answers.circuit_orientation.choice;
  assert.equal(ori(40, 5, 8, 8), 'vertical');
  assert.equal(ori(1.9, 0, 0, 0), 'none');
  assert.deepEqual(ORIENTATIONS, ['vertical', 'horizontal', 'diag45', 'diag135']);
});

test('U-28 score interpolation 5 levels v=0.6', () => {
  // neuron_score with soma in bin 2 giving v=0.6 is awkward; use unknown score key (v = 0.5) and evidence
  const req = { state: {}, model: 'm', questions: { zz: { type: 'score', instructions: 'x', criteria: ['a', 'b', 'c', 'd', 'e'] } } };
  assert.deepEqual(emulate(req, { seed: 1, callIndex: 0 }).answers.zz.probabilities, { 0: 0, 1: 0, 2: 1, 3: 0, 4: 0 });
  // evidence: (r1-r2)/(r1+5) = 0.6 -> r1=20, r2=5 -> 15/25
  const ev = emulate(withRates(20, 5, 0, 0), { seed: 1, callIndex: 0 }).answers.circuit_evidence;
  assert.deepEqual(ev.probabilities, { 0: 0, 1: 0, 2: 0.6, 3: 0.4, 4: 0 });
  assert.equal(ev.score, 2.4);
});

test('unknown keys: noul 0.5, choice uniform first key', () => {
  const req = { state: {}, model: 'm', questions: {
    a: { type: 'noul', instructions: 'x' },
    b: { type: 'choice', instructions: 'x', criteria: { p: null, q: null, r: null } },
  } };
  const r = emulate(req, { seed: 1, callIndex: 0 }).answers;
  assert.equal(r.a.noul, 0.5);
  assert.equal(r.b.choice, 'p');
  assert.equal(Math.round(sum(r.b.probabilities) * 100), 100);
});
