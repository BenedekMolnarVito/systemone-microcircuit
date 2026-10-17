// Simulated-mode JEV emulator (SPEC 3.5). Pure, deterministic. DOM-free.
import { mulberry32, streamSeed, STREAM } from '../core/rng.js';
import { fnv1a32 } from '../core/hash.js';
import { DEFAULTS } from '../core/params.js';
import { ORIENTATIONS } from './schema.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sigmoid = (x) => (x < -30 ? 0 : x > 30 ? 1 : 1 / (1 + Math.exp(-x)));
const r2 = (x) => Math.round(x * 100) / 100;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const entropy = (p) => p.reduce((h, x) => (x > 0 ? h - x * Math.log(x) : h), 0);
const conf = (p) => (p.length < 2 ? 1 : clamp(1 - entropy(p) / Math.log(p.length), 0, 1));
const argmax = (a) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0);
const norm = (p) => { const s = sum(p); return p.map((x) => x / s); };
const softmax = (l) => { const m = Math.max(...l); return norm(l.map((x) => Math.exp(x - m))); }; // tau_c = 1

// 2-decimal probability map; largest entry absorbs the residual so the sum is exactly 1.00
function probMap(keys, p) {
  const ints = p.map((x) => Math.round(x * 100));
  ints[argmax(p)] += 100 - sum(ints);
  return Object.fromEntries(keys.map((k, i) => [k, ints[i] / 100]));
}

// FR-JEV-16 local Score level of S given threshold theta
export function localScoreLevel(S, theta) {
  return S < -2 ? 0 : S < 2 ? 1 : S < theta - 3 ? 2 : S < theta ? 3 : 4;
}

function choiceAnswer(keys, p) {
  return { type: 'choice', choice: keys[argmax(p)], confidence: r2(conf(p)), probabilities: probMap(keys, p) };
}

function scoreAnswer(criteria, v) {
  const N = criteria.length;
  const x = v * (N - 1);
  const i = Math.floor(x);
  const f = x - i;
  const p = new Array(N).fill(0);
  p[i] = 1 - f;
  if (i < N - 1) p[i + 1] = f;
  return {
    type: 'score',
    score: r2(p.reduce((s, q, k) => s + k * q, 0)),
    confidence: r2(conf(p)),
    legend: Object.fromEntries(criteria.map((c, k) => [String(k), c])),
    probabilities: probMap(criteria.map((_, k) => String(k)), p),
  };
}

// default collateral bias b_k / apical gain gamma_k (SPEC 2.5)
const BG = {
  L4E: { ascending: [0.5, 0], recurrent: [0, 0] },
  L23E: { output: [0, 4], recurrent: [0.3, 0], lateral: [-0.3, 0] },
  L5E: { output: [0.5, 1], recurrent: [0, 0] },
};

export function emulate(request, ctx) {
  const rng = mulberry32((streamSeed(ctx.seed, STREAM.EMULATOR) ^ fnv1a32(String(ctx.callIndex))) >>> 0);
  const jit = () => (rng() - 0.5) * 0.04;
  const st = request.state || {};
  const th = st.threshold_mv ?? DEFAULTS.theta;
  const l4 = () => ORIENTATIONS.map((o) => st.l4_rates_hz?.[o] ?? 0);
  const answers = {};
  const keys = Object.keys(request.questions).sort();
  for (const key of keys) {
    const q = request.questions[key];
    if (key === 'circuit_orientation') {
      const r = l4();
      const T = sum(r) + 1e-6;
      const m = Math.max(...r);
      const l = [...r.map((x) => 6 * (x / T) * Math.min(m / 10, 1)), 6 * clamp(1 - m / 10, 0, 1)];
      answers[key] = choiceAnswer([...ORIENTATIONS, 'none'], norm(softmax(l).map((x) => Math.max(0, x + jit()))));
    } else if (key === 'circuit_novelty') {
      const r = l4();
      const rp = ORIENTATIONS.map((o) => st.prev_l4_rates_hz?.[o] ?? 0);
      const d = sum(r.map((x, i) => Math.abs(x - rp[i])));
      answers[key] = { type: 'noul', noul: r2(clamp((2 * d) / (sum(r) + sum(rp) + 10) + jit(), 0, 1)) };
    } else if (key === 'circuit_evidence') {
      const [a, b] = l4().sort((x, y) => y - x);
      answers[key] = scoreAnswer(q.criteria, clamp((a - b) / (a + 5), 0, 1));
    } else if (key === 'neuron_score') {
      const S = st.soma_mv ?? 0;
      const level = localScoreLevel(S, th);
      const [lo, hi] = [[-20, -2], [-2, 2], [2, th - 3], [th - 3, th], [th, 40]][level];
      const f = clamp((S - lo) / (hi - lo), 0, 0.99);
      answers[key] = scoreAnswer(q.criteria, clamp((level + f) / 4, 0, 1));
    } else if (key === 'neuron_noul') {
      const v = sigmoid(((st.soma_mv ?? 0) - th) / DEFAULTS.delta) + jit();
      answers[key] = { type: 'noul', noul: r2(clamp(v, 0, 1)) };
    } else if (key === 'neuron_choice') {
      const ck = Object.keys(q.criteria);
      const bg = BG[String(st.neuron).split('-')[0]] || {};
      const l = ck.map((c) => { const [b, g] = bg[c] || [0, 0]; return b + g * ((st.apical_mv ?? 0) / th); });
      answers[key] = choiceAnswer(ck, norm(softmax(l).map((x) => Math.max(0, x + jit()))));
    } else if (q.type === 'noul') {
      answers[key] = { type: 'noul', noul: 0.5 };
    } else if (q.type === 'choice') {
      const ck = Object.keys(q.criteria);
      answers[key] = choiceAnswer(ck, ck.map(() => 1 / ck.length));
    } else {
      answers[key] = scoreAnswer(q.criteria, 0.5);
    }
  }
  return {
    model: 'jev-sim',
    answers,
    usage: { input_tokens: Math.ceil(JSON.stringify(request).length / 4), output_tokens: 20 * keys.length },
  };
}
