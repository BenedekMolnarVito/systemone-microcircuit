import test from 'node:test';
import assert from 'node:assert/strict';
import { ABOUT as A } from '../../docs/js/ui/about-content.js';

const sections = {
  pitch: [A.pitch],
  mapping: [...A.mapping.rows.flat(), A.mapping.note],
  established: A.established,
  proposal: A.proposal,
  simplification: A.simplification,
  refs: A.refs.map((r) => r.text),
};
const FR9 = "In SIMULATED mode the JEV answers are computed by a simple local formula from L4 firing rates, not by the JEV model. Agreement in this mode shows the plumbing, not JEV's judgement. REPLAY and LIVE show genuine JEV answers.";
const all = Object.values(sections).flat();

test('U-57 sections non-empty', () => {
  for (const [k, v] of Object.entries(sections)) assert.ok(v.length && v.every((t) => t.trim()), k);
});
test('U-57 required sentences', () => {
  const p = sections.proposal.join('\n');
  assert.ok(p.includes('Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it.'));
  assert.ok(p.includes('Spiking neurons, leaky graded potentials'));
  const s = sections.simplification;
  assert.equal(s[3], FR9);
  assert.ok(s[1].includes('Population sizes are scaled down'));
  assert.ok(s[2].startsWith('[DEMO] In real axons'));
  assert.ok(s.length > 8);
});
test('U-57 citations in 1..39', () => {
  for (const t of all.map((x) => x.replace('[0, 1]', ''))) for (const m of t.matchAll(/\[(\d[\d,\s–-]*)\]/g))
    for (const n of m[1].match(/\d+/g)) assert.ok(n >= 1 && n <= 39, `${n} in ${t}`);
  assert.equal(A.refs.length, 39);
});
test('U-57 banned text absent', () => {
  const re = /roadmap|200.?300 ms|Douglas.{0,20}1995|SE-SNN|AllenYolk|\u03C4_N|tau[N]/i;
  for (const t of all) assert.ok(!re.test(t), t);
});
