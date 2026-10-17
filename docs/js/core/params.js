export const DT = 0.5; // ms, FR-SIM-01 (fixed)

const SPEEDS = [10, 25, 50, 100, 250, 500, 1000];
// [key, symbol, default, min, max, step, unit, source, options]; no min = fixed (unless boolean/options)
const ROWS = [
  ['tauM', 'τ_m', 10, 1, 50, 1, 'ms', 'Potjans & Diesmann Table 5 [14]'],
  ['tauBasal', 'τ_b', 10, , , , 'ms', 'DEMO (heterogeneous branch τ motivated by [2])'],
  ['tauApical', 'τ_a', 30, , , , 'ms', 'DEMO (motivated by [2])'],
  ['tRef', 't_ref', 2, , , , 'ms', '[14, 17]'],
  ['theta', 'θ', 15, 5, 40, 0.5, 'mV rel. rest', '[14]: −50 − (−65) = 15 mV'],
  ['vReset', 'V_reset', 0, , , , 'mV rel. rest', '[14] V_reset −65 mV; E_L −65 mV assumed (R2: not confirmed in HTML)'],
  ['delta', 'Δ', 2, 0.5, 10, 0.1, 'mV', 'DEMO (escape-noise slope; sigmoid form is a simplification of [16, 18])'],
  ['noulWindowMs', 'W', 10, , , , 'ms', 'DEMO (Noul = probability of ≥ 1 spike within W)'],
  ['sigmaV', 'σ_V', 3, 0, 10, 0.5, 'mV', 'DEMO (stationary membrane noise SD)'],
  ['g', 'g', 4, 0, 8, 0.1, 'ratio', 'DEMO (named after g in [14], where inhibitory PSPs are 4× excitatory; here g/4 scales hand-chosen inhibitory base weights)'],
  ['dExc', 'd_E', 1.5, , , , 'ms (→ 3 steps)', '[14]'],
  ['dInh', 'd_I', 0.8, , , , 'ms (→ 2 steps, rounded up)', '[14]'],
  ['dInput', 'd_in', 1.0, , , , 'ms (→ 2 steps)', 'DEMO'],
  ['aBasal', 'a_b', 1.0, , , , '—', 'DEMO'],
  ['aApical', 'a_a', 0.5, , , , '—', 'DEMO'],
  ['caAmp', 'A_ca', 10, , , , 'mV', 'DEMO (dendritic Ca²⁺ nonlinearity motivated by [29, 30])'],
  ['caTheta', 'θ_ca', 10, , , , 'mV', 'DEMO'],
  ['caDelta', 'Δ_ca', 1.5, , , , 'mV', 'DEMO'],
  ['tauShunt', 'τ_G', 5, , , , 'ms', 'DEMO'],
  ['pvMode', 'pvMode', 'subtractive', , , , '—', 'DEMO (divisive motivated by [28])', ['subtractive', 'divisive', 'both']],
  ['tauC', 'τ_c', 1.0, 0.05, 5, 0.05, '—', 'DEMO (routing temperature)'],
  ['routing', 'routing', 'hard', , , , '—', 'DEMO', ['hard', 'soft']],
  ['attention', 'A', 0.3, 0, 1, 0.05, '—', 'DEMO (top-down drive to VIP and apical dendrites)'],
  ['rTopDownMax', 'r_td', 40, , , , 'Hz', 'DEMO'],
  ['stdp', 'stdp', false, , , , 'on/off', 'DEMO'],
  ['tauPlus', 'τ₊', 20, , , , 'ms', '[25, 26] (window ≈ ±20 ms [25]; exponential τ values from [26])'],
  ['tauMinus', 'τ₋', 20, , , , 'ms', '[25, 26] (window ≈ ±20 ms [25]; exponential τ values from [26])'],
  ['aPlus', 'A₊', 0.01, , , , '× w_max', 'DEMO, ratio from [26], form from [27]'],
  ['aMinus', 'A₋', 0.0105, , , , '× w_max', 'DEMO, ratio from [26], form from [27]'],
  ['contrast', 'c', 1.0, 0, 2, 0.05, '—', 'DEMO'],
  ['pixelNoise', 'σ_px', 0.05, 0, 0.5, 0.01, 'intensity', 'DEMO'],
  ['rBase', 'r_base', 2, , , , 'Hz', 'DEMO'],
  ['rMax', 'r_max', 80, 10, 200, 10, 'Hz', 'DEMO'],
  ['wIn', 'W_in', 90, , , , 'mV (kernel-normalised)', 'DEMO'],
  ['wFfPv', 'w_ffPV', 0.4, , , , 'mV per pixel spike', 'DEMO'],
  ['jevControl', 'jevControl', true, , , , 'on/off', 'DEMO'],
  ['autoJev', 'autoJev', true, , , , 'on/off', 'DEMO'],
  ['jevIntervalMs', 'jevIntervalMs', 500, 100, 5000, 100, 'sim ms', 'DEMO'],
  ['liveMinIntervalMs', 'liveMinIntervalMs', 2000, 1000, 10000, 500, 'wall ms', 'DEMO'],
  ['budget', 'budget', 50, 0, 500, 1, 'LIVE calls / session', 'DEMO'],
  ['speed', 'speed', 100, , , , 'sim ms per wall s', 'DEMO', SPEEDS],
  ['seed', 'seed', 42, 0, 4294967295, , 'uint32', 'DEMO'],
];

const defaults = {};
const specs = {};
for (const [key, symbol, def, min, max, step, unit, source, options] of ROWS) {
  defaults[key] = def;
  const s = { symbol, unit, source, tag: source.startsWith('DEMO') ? 'DEMO' : 'REF' };
  if (min !== undefined) { s.min = min; s.max = max; }
  if (step !== undefined) s.step = step;
  if (options) s.options = Object.freeze([...options]);
  specs[key] = Object.freeze(s);
}
export const DEFAULTS = Object.freeze(defaults);
export const PARAM_SPECS = Object.freeze(specs);

// Returns only the supplied keys, clamped; unknown/invalid dropped; fixed keys dropped unless allowFixed (FR-SIM-04).
// Caller merges into its current params.
export function clampParams(p, { allowFixed = false } = {}) {
  const out = {};
  for (const k of Object.keys(p ?? {})) {
    const spec = PARAM_SPECS[k];
    if (!spec) continue;
    const v = p[k];
    if (typeof DEFAULTS[k] === 'boolean') {
      if (typeof v === 'boolean') out[k] = v;
    } else if (spec.options) {
      if (spec.options.includes(v)) out[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      if ('min' in spec) {
        const c = Math.min(spec.max, Math.max(spec.min, v));
        out[k] = k === 'seed' || k === 'budget' ? Math.floor(c) : c;
      } else if (allowFixed) out[k] = v;
    }
  }
  return out;
}

export function derive(p) {
  const lam = (tau) => Math.exp(-DT / tau);
  return {
    dt: DT,
    lamM: lam(p.tauM), lamB: lam(p.tauBasal), lamA: lam(p.tauApical), lamG: lam(p.tauShunt),
    lamPlus: lam(p.tauPlus), lamMinus: lam(p.tauMinus),
    refSteps: Math.round(p.tRef / DT),
    dExcSteps: Math.ceil(p.dExc / DT), dInhSteps: Math.ceil(p.dInh / DT), dInputSteps: Math.ceil(p.dInput / DT),
    noulExp: DT / p.noulWindowMs,
  };
}

export function parseSeed(s) {
  const t = String(s).trim();
  const n = Number(t);
  if (!/^\d+$/.test(t) || n > 4294967295) return { ok: false, error: 'Seed must be an integer from 0 to 4294967295' };
  return { ok: true, seed: n };
}
