// JEV request builders + request/response validation (SPEC 3.4, 3.8). DOM-free.
export const ORIENTATIONS = ['vertical', 'horizontal', 'diag45', 'diag135'];

const CIRCUIT_QUESTIONS = {
  circuit_orientation: {
    type: 'choice',
    instructions: 'These are firing rates of orientation-tuned neuron groups in a small model of visual cortex. Which edge orientation does the stimulus most likely contain?',
    criteria: {
      vertical: 'Vertical edges or bars dominate',
      horizontal: 'Horizontal edges or bars dominate',
      diag45: 'Diagonal edges from bottom-left to top-right dominate',
      diag135: 'Diagonal edges from top-left to bottom-right dominate',
      none: 'No clear oriented structure (blank, uniform, or noise)',
    },
  },
  circuit_novelty: {
    type: 'noul',
    instructions: 'Is the layer-4 activity in this window substantially different from the previous window, suggesting a new stimulus?',
  },
  circuit_evidence: {
    type: 'score',
    instructions: 'How strong is the evidence for a single dominant orientation?',
    criteria: ['No evidence', 'Weak', 'Moderate', 'Strong', 'Unambiguous'],
  },
};

const COLLATERAL_DESC = {
  ascending: () => 'Feedforward to layer 2/3',
  recurrent: (pre) => (pre === 'L23E' ? 'Recurrent excitation within layer 2/3' : 'Recurrent excitation within the layer'),
  output: (pre) => (pre === 'L23E' ? 'Descending output to layer 5' : 'Output to subcortical targets'),
  lateral: () => 'Recruit lateral inhibition',
};

const clone = (o) => JSON.parse(JSON.stringify(o));

export function circuitRequest(summary) {
  return { state: summary, model: 'jev-latest', questions: clone(CIRCUIT_QUESTIONS) };
}

export function neuronRequest(s) {
  const pre = String(s.neuron).split('-')[0];
  const questions = {
    neuron_score: {
      type: 'score',
      instructions: "Rate this model neuron's somatic membrane state relative to its firing threshold.",
      criteria: ['Hyperpolarized (below rest)', 'At rest', 'Depolarized, clearly subthreshold', 'Near threshold', 'At or above threshold'],
    },
    neuron_noul: { type: 'noul', instructions: 'Will this neuron fire a spike within the next 10 ms?' },
  };
  if (s.collaterals.length) {
    const criteria = {};
    for (const c of s.collaterals) criteria[c.id] = (COLLATERAL_DESC[c.id] || (() => c.id))(pre);
    questions.neuron_choice = {
      type: 'choice',
      instructions: 'If this neuron fires now, which axon collateral should carry the spike?',
      criteria,
    };
  }
  return { state: s, model: 'jev-latest', questions };
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Shared with proxy: shape check of an outgoing request body (3.1, 3.3).
export function validateRequest(body) {
  if (!isObj(body)) return { ok: false, reason: 'body must be an object' };
  if (body.state === null || !['string', 'object'].includes(typeof body.state)) return { ok: false, reason: 'state must be string, object or array' };
  if (typeof body.model !== 'string' || !body.model) return { ok: false, reason: 'model must be a non-empty string' };
  if (!isObj(body.questions)) return { ok: false, reason: 'questions must be an object' };
  const keys = Object.keys(body.questions);
  if (keys.length < 1 || keys.length > 8) return { ok: false, reason: 'questions count must be 1..8' };
  for (const k of keys) {
    const q = body.questions[k];
    if (!isObj(q) || typeof q.instructions !== 'string') return { ok: false, reason: `${k}: instructions required` };
    if (q.type === 'noul') continue;
    if (q.type === 'choice') {
      const n = isObj(q.criteria) ? Object.keys(q.criteria).length : 0;
      if (n < 1 || n > 255) return { ok: false, reason: `${k}: choice criteria must be a map of 1..255 options` };
    } else if (q.type === 'score') {
      if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10) return { ok: false, reason: `${k}: score criteria must be an array of 2..10 levels` };
    } else return { ok: false, reason: `${k}: unknown type` };
  }
  return { ok: true };
}

// Clamp + renormalise a probability map over allowed `keys`; null if invalid (non-finite, unknown key, sum 0).
function normProbs(p, keys) {
  if (!isObj(p)) return null;
  const out = {};
  let sum = 0;
  for (const k of Object.keys(p)) {
    if (!keys.includes(k) || !fin(p[k])) return null;
    out[k] = clamp(p[k], 0, 1);
    sum += out[k];
  }
  if (!(sum > 0)) return null;
  for (const k of Object.keys(out)) out[k] /= sum;
  return out;
}

export function validateResponse(request, json) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isObj(json) || !isObj(json.answers)) return bad('missing answers');
  const response = {
    model: typeof json.model === 'string' && json.model.length <= 64 ? json.model : 'unknown',
    answers: {},
  };
  const u = json.usage;
  if (isObj(u) && Number.isInteger(u.input_tokens) && u.input_tokens >= 0 && Number.isInteger(u.output_tokens) && u.output_tokens >= 0) {
    response.usage = { input_tokens: u.input_tokens, output_tokens: u.output_tokens };
  }
  for (const [k, q] of Object.entries(request.questions)) {
    const a = json.answers[k];
    if (!isObj(a)) return bad(`${k}: missing answer`);
    if (a.type !== q.type) return bad(`${k}: type mismatch`);
    if (q.type === 'noul') {
      if (!fin(a.noul)) return bad(`${k}: noul not a finite number`);
      response.answers[k] = { type: 'noul', noul: clamp(a.noul, 0, 1) };
      continue;
    }
    if (!fin(a.confidence)) return bad(`${k}: confidence not a finite number`);
    const confidence = clamp(a.confidence, 0, 1);
    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria);
      if (typeof a.choice !== 'string' || !keys.includes(a.choice)) return bad(`${k}: choice not in criteria`);
      const probabilities = normProbs(a.probabilities, keys);
      if (!probabilities) return bad(`${k}: invalid probabilities`);
      response.answers[k] = { type: 'choice', choice: a.choice, confidence, probabilities };
    } else {
      const N = q.criteria.length;
      const probabilities = normProbs(a.probabilities, Array.from({ length: N }, (_, i) => String(i)));
      if (!probabilities) return bad(`${k}: invalid probabilities`);
      if (!fin(a.score)) return bad(`${k}: score not a finite number`);
      const legend = {};
      if (isObj(a.legend)) for (const lk of Object.keys(a.legend)) legend[lk] = String(a.legend[lk]).slice(0, 200);
      response.answers[k] = { type: 'score', score: clamp(a.score, 0, N - 1), confidence, legend, probabilities };
    }
  }
  // Response strings are data; render only via textContent (NFR-SEC-06).
  return { ok: true, response, answers: response.answers, textOnly: true };
}
