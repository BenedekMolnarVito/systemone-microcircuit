import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circuitRequest, neuronRequest, validateRequest, validateResponse } from '../../docs/js/jev/schema.js';
import { summarizeCircuit, summarizeNeuron } from '../../docs/js/jev/summary.js';
import { DT } from '../../docs/js/core/params.js';

// stub of the SPEC 5.2 Sim interface
function stubSim(spikes, n = 400) {
  const sp = Int32Array.from(spikes.flat());
  const N = 58;
  return {
    n, t: n * DT, params: { theta: 15 },
    state: { S: Float32Array.from({ length: N }, (_, i) => i * 0.1), Db: new Float32Array(N).fill(14.14), Da: new Float32Array(N).fill(2.44),
      ref: new Int32Array(N), lastSpikeStep: Int32Array.from({ length: N }, (_, i) => (i === 25 ? 390 : -1)) },
    spikesSince: (n0) => { const out = []; for (let q = 0; q < sp.length; q += 2) if (sp[q] >= n0) out.push(sp[q], sp[q + 1]); return Int32Array.from(out); },
  };
}
const circ = () => {
  // window 100 ms = 200 steps; 4 L4E vertical cells (idx 0-3) spike 10x each in window -> 100 Hz... 10/0.1s
  const spikes = [];
  for (let c = 0; c < 4; c++) for (let s = 0; s < 10; s++) spikes.push([250 + s, c]);
  spikes.push([100, 0]); // outside window
  return summarizeCircuit(stubSim(spikes), {}, 100, null, 'vbar', 'vertical');
};

test('U-29 requests pass validateRequest; criteria shapes', () => {
  const c = circuitRequest(circ());
  assert.deepEqual(validateRequest(c), { ok: true });
  assert.ok(Array.isArray(c.questions.circuit_evidence.criteria));
  assert.ok(Object.keys(c.questions.circuit_orientation.criteria).length <= 255);
  const n = neuronRequest(summarizeNeuron(stubSim([]), {}, 'L23E-5'));
  assert.deepEqual(validateRequest(n), { ok: true });
  assert.deepEqual(Object.keys(n.questions.neuron_choice.criteria), ['output', 'recurrent', 'lateral']);
  const pv = neuronRequest(summarizeNeuron(stubSim([]), {}, 'L23PV-0'));
  assert.equal(Object.keys(pv.questions).length, 2);
  assert.equal(validateRequest({ ...c, questions: { q: { type: 'score', instructions: 'x', criteria: { a: 'b' } } } }).ok, false);
  assert.equal(validateRequest({ ...c, model: 3 }).ok, false);
});

test('summarizeCircuit: rates, rounding, key order', () => {
  const s = circ();
  assert.equal(s.l4_rates_hz.vertical, 100); // 40 spikes / 4 cells / 0.1 s
  assert.equal(s.l4_rates_hz.horizontal, 0);
  assert.equal(s.simTimeMs, 200);
  assert.equal(s.windowMs, 100);
  assert.deepEqual(Object.keys(s), ['kind', 'description', 'simTimeMs', 'windowMs', 'stimulus', 'l4_rates_hz', 'l23_rates_hz', 'l5_rates_hz',
    'inhibitory_rates_hz', 'prev_l4_rates_hz', 'local_readout']);
});

test('summarizeNeuron: L23E-5', () => {
  const net = { trunk: [], collaterals: [] };
  net.collaterals[24] = [{ targets: [{ target: 25 }] }, { targets: [] }];
  const sim = stubSim([[395, 24], [395, 3]]);
  const s = summarizeNeuron(sim, net, 'L23E-5');
  assert.equal(s.preferred_orientation, 'horizontal');
  assert.equal(s.population, 'L2/3 excitatory pyramidal');
  assert.equal(s.soma_mv, 2.5);
  assert.equal(s.threshold_mv, 15);
  assert.equal(s.basal_mv, 14.1);
  assert.equal(s.apical_mv, 2.4);
  assert.equal(s.refractory, false);
  assert.equal(s.ms_since_last_spike, 5);
  assert.deepEqual(s.input_spikes_last_10ms, { excitatory: 1, inhibitory: 0 });
  assert.equal(s.collaterals.length, 3);
});

const req = () => circuitRequest(circ());
const good = () => ({
  model: 'jev-1.13.0',
  answers: {
    circuit_orientation: { type: 'choice', choice: 'vertical', confidence: 0.9, probabilities: { vertical: 0.9, horizontal: 0.1 } },
    circuit_novelty: { type: 'noul', noul: 0.3 },
    circuit_evidence: { type: 'score', score: 3, confidence: 0.5, legend: { 0: 'a' }, probabilities: { 3: 1 } },
  },
  usage: { input_tokens: 10, output_tokens: 5 },
});

test('U-42 response validation', () => {
  assert.equal(validateResponse(req(), good()).ok, true);
  let j = good(); j.answers.circuit_novelty.noul = 7;
  assert.equal(validateResponse(req(), j).response.answers.circuit_novelty.noul, 1);
  j = good(); j.answers.circuit_novelty.noul = '0.5';
  assert.equal(validateResponse(req(), j).ok, false);
  j = good(); j.answers.circuit_orientation.choice = 'admin';
  assert.equal(validateResponse(req(), j).ok, false);
  j = good(); j.answers.circuit_orientation.probabilities = { vertical: 0, horizontal: 0 };
  assert.equal(validateResponse(req(), j).ok, false);
  j = good(); delete j.answers.circuit_novelty;
  assert.equal(validateResponse(req(), j).ok, false);
  j = good(); j.answers.extra = { type: 'noul', noul: 1 };
  assert.deepEqual(Object.keys(validateResponse(req(), j).response.answers).sort(), ['circuit_evidence', 'circuit_novelty', 'circuit_orientation']);
  j = good(); j.model = 'x'.repeat(65); j.usage = { input_tokens: -1, output_tokens: 1 };
  const r = validateResponse(req(), j).response;
  assert.equal(r.model, 'unknown');
  assert.equal(r.usage, undefined);
  assert.equal(validateResponse(req(), null).ok, false);
  // renormalised
  const p = validateResponse(req(), good()).response.answers.circuit_orientation.probabilities;
  assert.ok(Math.abs(p.vertical + p.horizontal - 1) < 1e-12);
});

test('U-43 legend truncation, markup preserved as text', () => {
  const j = good();
  j.answers.circuit_evidence.legend = { 0: 'x'.repeat(10000), 1: '<script>alert(1)</script>' };
  const v = validateResponse(req(), j);
  assert.equal(v.response.answers.circuit_evidence.legend[0].length, 200);
  assert.equal(v.response.answers.circuit_evidence.legend[1], '<script>alert(1)</script>');
  assert.equal(v.textOnly, true);
});
