// REPLAY recording: validate, match, build entries (SPEC 3.6). DOM-free.
import { fnv1a32, canonicalJSON, hex8 } from '../core/hash.js';

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ORI = ['vertical', 'horizontal', 'diag45', 'diag135'];

export function validateRecording(json) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isObj(json)) return bad('not an object');
  if (json.format !== 'jev-recording') return bad('wrong format');
  if (json.version !== 1) return bad('wrong version');
  if (!Array.isArray(json.entries)) return bad('missing entries');
  for (const [k, e] of json.entries.entries()) {
    if (!isObj(e)) return bad(`entry ${k}: not an object`);
    if (typeof e.requestHash !== 'string') return bad(`entry ${k}: missing requestHash`);
    if (!isObj(e.matchKey) || !Array.isArray(e.matchKey.features)) return bad(`entry ${k}: missing matchKey`);
    if (!isObj(e.response) || !isObj(e.response.answers)) return bad(`entry ${k}: missing response.answers`);
  }
  return { ok: true, recording: json };
}

export const requestHash = (request) => hex8(fnv1a32(canonicalJSON({ state: request.state, questions: request.questions })));

export function matchKey(request) {
  const s = request.state;
  const questionKeys = Object.keys(request.questions).sort();
  if (s.kind === 'circuit_summary') {
    const r = ORI.map((o) => s.l4_rates_hz[o]);
    const sum = Math.max(r.reduce((a, b) => a + b, 0), 1);
    return { kind: s.kind, stimulus: s.stimulus, questionKeys, features: [...r.map((x) => x / sum), Math.min(Math.max(...r), 50) / 50] };
  }
  return {
    kind: s.kind, population: s.population, questionKeys,
    features: [s.soma_mv / s.threshold_mv, s.apical_mv / s.threshold_mv, Math.min(s.rate_hz_last_200ms, 50) / 50],
  };
}

const l1 = (a, b) => (a.length === b.length ? a.reduce((t, x, i) => t + Math.abs(x - b[i]), 0) : Infinity);

export function findMatch(recording, request) {
  const h = requestHash(request);
  const exact = recording.entries.find((e) => e.requestHash === h);
  if (exact) return { entry: exact, kind: 'exact' };
  const mk = matchKey(request);
  const qk = mk.questionKeys.join(',');
  const limit = mk.kind === 'circuit_summary' ? 0.25 : 0.3;
  let best = null, bestD = Infinity;
  for (const e of recording.entries) {
    const k = e.matchKey;
    if (k.kind !== mk.kind || k.stimulus !== mk.stimulus || k.population !== mk.population) continue;
    if (!Array.isArray(k.questionKeys) || [...k.questionKeys].sort().join(',') !== qk) continue;
    const d = l1(k.features, mk.features);
    if (d <= limit && d < bestD) { best = e; bestD = d; } // strict < keeps first on ties (lowest i)
  }
  return best ? { entry: best, kind: 'nearest' } : null;
}

// FR-REC-01a: only validated answers, question types, matchKey, minimal digest.
export function buildRecordingEntry(i, simTimeMs, request, validatedResponse, latencyMs) {
  const s = request.state;
  const stateDigest = { kind: s.kind, simTimeMs: simTimeMs ?? null };
  if (s.kind === 'circuit_summary') stateDigest.stimulus = s.stimulus; else stateDigest.population = s.population;
  const response = { model: validatedResponse.model, answers: validatedResponse.answers };
  if (validatedResponse.usage) response.usage = validatedResponse.usage;
  return {
    i, simTimeMs: simTimeMs ?? null, requestHash: requestHash(request), matchKey: matchKey(request),
    questions: Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, q.type])),
    stateDigest, response, latencyMs, recordedAtMs: Date.now(),
  };
}

export function buildRecording(meta, entries) {
  const m = meta || {};
  return {
    format: 'jev-recording', version: 1,
    recordedAt: m.recordedAt ?? new Date().toISOString(),
    model: m.model ?? null,
    app: { name: 'systemone-microcircuit', commit: m.app?.commit ?? null },
    seed: m.seed ?? null, params: m.params ?? null, stimulusSequence: m.stimulusSequence ?? null,
    usageTotal: m.usageTotal ?? null,
    entries,
  };
}

// Log <details> payload: whitelist, so a key can never ride along (U-39).
export function serializeLogEntry(entry) {
  const out = {};
  for (const k of ['i', 'kind', 'status', 'mode', 'simTimeMs', 'latencyMs', 'model', 'usage', 'request', 'response', 'error']) {
    if (entry[k] !== undefined) out[k] = entry[k];
  }
  return JSON.parse(JSON.stringify(out));
}
