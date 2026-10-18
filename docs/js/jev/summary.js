// Sim state -> JEV `state` objects (SPEC 3.4.1, 3.4.2). DOM-free, numbers rounded to 1 decimal (FR-JEV-15).
import { DT, DEFAULTS } from '../core/params.js';
import { ORIENTATIONS as ORI } from './schema.js';

const r1 = (x) => Math.round(x * 10) / 10;
// [start index, count, description] per population (SPEC 2.1)
const POP = {
  L4E: [0, 16, 'L4 excitatory spiny stellate'], L4PV: [16, 4, 'L4 PV interneuron'],
  L23E: [20, 16, 'L2/3 excitatory pyramidal'], L23PV: [36, 4, 'L2/3 PV interneuron'],
  L23SST: [40, 4, 'L2/3 SST interneuron'], L23VIP: [44, 2, 'L2/3 VIP interneuron'],
  L5E: [46, 8, 'L5 excitatory pyramidal'], L5PV: [54, 2, 'L5 PV interneuron'], L5SST: [56, 2, 'L5 SST interneuron'],
};
const GROUP_SIZE = { L4E: 4, L23E: 4, L5E: 2 };
const orient = (pre, k) => Math.floor(k / GROUP_SIZE[pre]);

function countsSince(sim, steps) {
  const counts = new Int32Array(58);
  const sp = sim.spikesSince(Math.max(0, sim.n - steps));
  for (let q = 0; q < sp.length; q += 2) counts[sp[q + 1]]++;
  return counts;
}
const popSum = (counts, pre) => { const [s, c] = POP[pre]; let t = 0; for (let i = s; i < s + c; i++) t += counts[i]; return t; };
function orientRates(counts, pre, sec) {
  const [s, c] = POP[pre];
  const per = [0, 0, 0, 0];
  for (let k = 0; k < c; k++) per[orient(pre, k)] += counts[s + k];
  return Object.fromEntries(ORI.map((o, j) => [o, r1(per[j] / GROUP_SIZE[pre] / sec)]));
}

// prevWindow: previous l4_rates_hz object or null (null -> zeros). localLabel: readout label string.
export function summarizeCircuit(sim, network, windowMs, prevWindow, stimulusId, localLabel) {
  const sec = windowMs / 1000;
  const c = countsSince(sim, Math.round(windowMs / DT));
  const inh = (pres, n) => r1(pres.reduce((t, p) => t + popSum(c, p), 0) / n / sec);
  return {
    kind: 'circuit_summary',
    description: 'Rates of a 58-neuron model visual cortex column over the last window.',
    simTimeMs: r1(sim.t),
    windowMs: r1(windowMs),
    stimulus: stimulusId,
    l4_rates_hz: orientRates(c, 'L4E', sec),
    l23_rates_hz: orientRates(c, 'L23E', sec),
    l5_rates_hz: orientRates(c, 'L5E', sec),
    inhibitory_rates_hz: { pv: inh(['L4PV', 'L23PV', 'L5PV'], 10), sst: inh(['L23SST', 'L5SST'], 6), vip: inh(['L23VIP'], 2) },
    prev_l4_rates_hz: Object.fromEntries(ORI.map((o) => [o, r1(+prevWindow?.[o] || 0)])),
    local_readout: localLabel,
  };
}

const COLLATERALS = {
  L4E: [['ascending', 'L2/3 excitatory cells of the same orientation'], ['recurrent', 'L4 excitatory cells of the same orientation']],
  L23E: [['output', 'L5 excitatory cells of the same orientation'], ['recurrent', 'L2/3 excitatory cells of the same orientation'], ['lateral', 'L2/3 SST interneurons (lateral inhibition)']],
  L5E: [['output', 'subcortical targets (readout)'], ['recurrent', 'L5 excitatory cells of the same orientation']],
};
const ROUTING = {
  L4E: 'Collateral choice is a softmax over fixed biases; the ascending collateral is favored.',
  L23E: 'Higher apical (top-down) depolarization favors the output collateral.',
  L5E: 'Higher apical (top-down) depolarization favors the output collateral.',
};

// Presynaptic spikes of connected cells (all collateral synapses, regardless of routing; pixel/top-down input excluded)
// Presynaptic spikes received in the last 10 ms, split by synapse sign (network.trunk/collaterals indexed by source).
function inputSpikes(sim, network, i) {
  const res = { excitatory: 0, inhibitory: 0 };
  const sp = sim.spikesSince(Math.max(0, sim.n - Math.round(10 / DT)));
  for (let q = 0; q < sp.length; q += 2) {
    const j = sp[q + 1];
    const lists = [network.trunk?.[j] || [], ...(network.collaterals?.[j] || []).map((c) => c.targets)];
    for (const syn of lists.flat()) if (syn.target === i) res[syn.inhibitory ? 'inhibitory' : 'excitatory']++;
  }
  return res;
}

export function summarizeNeuron(sim, network, id) {
  const [pre, ks] = id.split('-');
  if (!POP[pre]) throw new Error(`unknown neuron id: ${id}`);
  const k = Number(ks);
  const i = POP[pre][0] + k;
  const e = pre in GROUP_SIZE;
  const last = sim.state.lastSpikeStep[i];
  return {
    kind: 'neuron_summary',
    simTimeMs: r1(sim.t),
    neuron: id,
    population: POP[pre][2],
    preferred_orientation: e ? ORI[orient(pre, k)] : 'none',
    soma_mv: r1(sim.state.S[i]),
    threshold_mv: r1(sim.params?.theta ?? DEFAULTS.theta),
    basal_mv: e ? r1(sim.state.Db[i]) : 0,
    apical_mv: e ? r1(sim.state.Da[i]) : 0,
    refractory: sim.state.ref[i] > 0,
    ms_since_last_spike: last < 0 ? -1 : r1((sim.n - last) * DT), // -1 = never fired
    rate_hz_last_200ms: r1(countsSince(sim, Math.round(200 / DT))[i] / 0.2),
    input_spikes_last_10ms: inputSpikes(sim, network, i),
    collaterals: (COLLATERALS[pre] || []).map(([cid, target]) => ({ id: cid, target })),
    routing_rule: ROUTING[pre] || 'Interneuron: all outgoing synapses fire; no collateral choice.',
  };
}
