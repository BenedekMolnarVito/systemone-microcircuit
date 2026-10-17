import { mulberry32, streamSeed, STREAM } from './rng.js';
import { DEFAULTS, derive } from './params.js';
import { makeKernel } from './encoding.js';

export const COMP = Object.freeze({ BASAL: 0, APICAL: 1, SOMA: 2 });
const OFFSETS = [-3, -1, 1, 3];

// [id, count, excitatory, hasDendrites]
const POPS = [
  ['L4E', 16, true], ['L4PV', 4, false], ['L23E', 16, true], ['L23PV', 4, false], ['L23SST', 4, false],
  ['L23VIP', 2, false], ['L5E', 8, true], ['L5PV', 2, false], ['L5SST', 2, false],
];
const GROUP = { L4E: 4, L23E: 4, L5E: 2 }; // neurons per orientation group

// Collateral defs (SPEC 2.5): [id, b, gamma, targetPop|null, comp, w, p, sameGroup]
const COLLATERALS = {
  L4E: [['ascending', 0.5, 0, 'L23E', COMP.BASAL, 12, 1, 'group'], ['recurrent', 0, 0, 'L4E', COMP.BASAL, 4, 0.5, 'others']],
  L23E: [['output', 0, 4, 'L5E', COMP.BASAL, 12, 1, 'group'], ['recurrent', 0.3, 0, 'L23E', COMP.BASAL, 4, 0.5, 'others'],
    ['lateral', -0.3, 0, 'L23SST', COMP.SOMA, 6, 1, 'all']],
  L5E: [['output', 0.5, 1, null], ['recurrent', 0, 0, 'L5E', COMP.BASAL, 4, 1, 'others']],
};

// Trunk + interneuron rows (SPEC 2.6, table order): [src, tgt, comp, w(base, signed), p, 'E'|'I']
const ROWS = [
  ['L4E', 'L4PV', COMP.SOMA, 4, 0.5, 'E'], ['L4PV', 'L4E', COMP.SOMA, -3, 0.75, 'I'],
  ['L23E', 'L23PV', COMP.SOMA, 4, 0.5, 'E'], ['L23PV', 'L23E', COMP.SOMA, -3, 0.75, 'I'],
  ['L23SST', 'L23E', COMP.APICAL, -4, 0.75, 'I'], ['L23SST', 'L23PV', COMP.SOMA, -2, 0.5, 'I'],
  ['L23VIP', 'L23SST', COMP.SOMA, -6, 1, 'I'], ['L23E', 'L23VIP', COMP.SOMA, 1, 0.3, 'E'],
  ['L5E', 'L5PV', COMP.SOMA, 4, 1, 'E'], ['L5E', 'L5SST', COMP.SOMA, 3, 1, 'E'],
  ['L5PV', 'L5E', COMP.SOMA, -3, 0.75, 'I'], ['L5SST', 'L5E', COMP.APICAL, -4, 0.75, 'I'],
];

function layout(ids) {
  const pops = [], neurons = [];
  for (const [id, count, exc] of POPS) {
    if (!ids.includes(id)) continue;
    pops.push({ id, start: neurons.length, count, excitatory: exc });
    const gs = GROUP[id];
    for (let k = 0; k < count; k++) {
      neurons.push({
        id: `${id}-${k}`, pop: id, k, index: neurons.length, excitatory: exc,
        o: gs ? Math.floor(k / gs) : -1, j: gs ? k % gs : -1,
      });
    }
  }
  return { pops, neurons };
}

function collateralTargets(def, src, neurons) {
  const [, , , tp, , , , mode] = def;
  return neurons.filter((t) => t.pop === tp && t.index !== src.index
    && (mode === 'all' || t.o === src.o)).map((t) => t.index);
}

export function buildNetwork(params, seed) {
  const p = { ...DEFAULTS, ...params };
  const d = derive(p);
  const dSteps = { E: d.dExcSteps, I: d.dInhSteps };
  const { pops, neurons } = layout(POPS.map((x) => x[0]));
  const N = neurons.length;
  const rng = mulberry32(streamSeed(seed, STREAM.TOPOLOGY));
  let draws = 0;
  const connect = (pr) => { if (pr >= 1) return true; draws++; return rng() < pr; };

  const trunk = Array.from({ length: N }, () => []);
  const collaterals = Array.from({ length: N }, () => []);
  const plastic = [];

  // (1) collaterals: sources asc, k asc, targets asc
  for (const src of neurons) {
    const defs = COLLATERALS[src.pop];
    if (!defs) continue;
    defs.forEach((def, k) => {
      const [id, b, gamma, tp, comp, w, pr] = def;
      const targets = [];
      if (tp) {
        for (const t of collateralTargets(def, src, neurons)) {
          if (connect(pr)) targets.push({ target: t, comp, w0: w, dSteps: dSteps.E, inhibitory: false });
        }
      }
      if (id !== 'lateral') targets.forEach((_, s) => plastic.push(src.index, k, s));
      collaterals[src.index].push({ id, k, b, gamma, targets });
    });
  }
  // (2) trunk + interneuron outputs, rows in table order
  for (const [sp, tp, comp, w, pr, dl] of ROWS) {
    for (const s of neurons) {
      if (s.pop !== sp) continue;
      for (const t of neurons) {
        if (t.pop !== tp) continue;
        if (connect(pr)) trunk[s.index].push({ target: t.index, comp, w0: w, dSteps: dSteps[dl], inhibitory: w < 0 });
      }
    }
  }
  const kernels = neurons.filter((n) => n.pop === 'L4E').map((n) => makeKernel(n.o, OFFSETS[n.j]));
  return { N, pops, neurons, trunk, collaterals, kernels, plastic: Int32Array.from(plastic), topologyDraws: draws };
}

// Test harness: one neuron, no synapses, no kernels. E pops keep collateral defs with empty targets.
export function buildSingleNeuronNetwork(pop) {
  const { pops, neurons } = layout([pop]);
  if (!pops.length) throw new Error(`unknown pop ${pop}`);
  const one = { ...pops[0], count: 1 };
  const n = { ...neurons[0], o: neurons[0].o < 0 ? -1 : 0 };
  const cols = (COLLATERALS[pop] || []).map(([id, b, gamma], k) => ({ id, k, b, gamma, targets: [] }));
  return { N: 1, pops: [one], neurons: [n], trunk: [[]], collaterals: [cols], kernels: [], plastic: new Int32Array(0), topologyDraws: 0 };
}
