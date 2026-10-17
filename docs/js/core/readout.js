// Local readout + agreement (SPEC 2.9, FR-RO-01..03). DOM-free.
import { DT } from './params.js';

const ORI = ['vertical', 'horizontal', 'diag45', 'diag135'];

// spikeLog: sim.routesSince(n0) entries [{n, src, k, p}]; n: current sim step count.
// routing: 'hard' counts 1 when k is the L5E `output` collateral, 'soft' counts p[k_output].
export function localReadout(spikeLog, n, network, windowMs = 200, routing = 'hard') {
  const n0 = n - Math.round(windowMs / DT);
  const counts = [0, 0, 0, 0];
  for (const r of spikeLog) {
    if (r.n < n0 || r.n >= n) continue;
    const nr = network.neurons[r.src];
    if (nr.pop !== 'L5E') continue;
    const ko = network.collaterals[r.src].findIndex((c) => c.id === 'output');
    if (ko < 0) continue;
    counts[nr.o] += routing === 'soft' ? r.p[ko] : r.k === ko ? 1 : 0;
  }
  const sum = counts.reduce((a, b) => a + b, 0);
  const probs = counts.map((c) => (sum > 0 ? c / sum : 0));
  let label = 'nothing';
  if (sum >= 4) {
    let best = 0;
    for (let o = 1; o < 4; o++) if (counts[o] > counts[best]) best = o; // ties → lower o
    const c2 = Math.max(...counts.filter((_, o) => o !== best));
    label = counts[best] >= 1.5 * c2 && counts[best] >= 4 ? ORI[best] : 'uncertain';
  }
  return { label, counts, probs };
}

export function agree(localLabel, jevChoice) {
  if (jevChoice == null) return null;
  if (jevChoice === 'none') return localLabel === 'nothing' || localLabel === 'uncertain';
  return localLabel === jevChoice;
}
