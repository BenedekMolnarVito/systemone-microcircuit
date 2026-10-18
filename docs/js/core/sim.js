// Sim core (SPEC 2.2-2.10, 5.2). Step order of SPEC 2.4 is normative (determinism).
import { mulberry32, streamSeed, gauss, STREAM } from './rng.js';
import { hex8 } from './hash.js';
import { DEFAULTS, clampParams, derive } from './params.js';
import { effectiveIntensity } from './stimuli.js';
import { rates } from './encoding.js';

const L = 4; // delay ring slots
const RETAIN = 20000; // steps of spike/route log kept (10 s sim; JEV window max 5 s)
const FNV0 = 0x811c9dc5;
// fnv1a32 over one uint32, little-endian bytes (FR-DET-03), incremental
const fnvU32 = (h, v) => { for (let b = 0; b < 32; b += 8) h = Math.imul(h ^ ((v >>> b) & 255), 0x01000193) >>> 0; return h; };
const sig = (x) => (x < -30 ? 0 : x > 30 ? 1 : 1 / (1 + Math.exp(-x)));
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export function spikeHazard(noul, noulExp) {
  return 1 - Math.pow(1 - noul, noulExp);
}

export function createSim(network, params, seed, opts = {}) {
  const test = !!opts.test;
  const { N, neurons } = network;
  const exc = neurons.map((x) => !!x.excitatory);
  const isPV = neurons.map((x) => x.pop.endsWith('PV'));
  const isL23E = neurons.map((x) => x.pop === 'L23E');
  const idx = (pops) => neurons.map((x, i) => (pops.includes(x.pop) ? i : -1)).filter((i) => i >= 0);
  const L4E = idx(['L4E']), L4PV = idx(['L4PV']), TD = idx(['L23E', 'L5E', 'L23VIP']);
  const nE = exc.filter(Boolean).length;
  const cols = network.collaterals.map((l) => l || []);
  const trunk = network.trunk.map((l) => l || []);

  // Plastic synapses (SPEC 2.8): incoming per post sorted by pre, outgoing per pre sorted by post.
  const inc = Array.from({ length: N }, () => []), out = Array.from({ length: N }, () => []);
  const pl = network.plastic || [];
  for (let q = 0; q < pl.length; q += 3) {
    const e = { pre: pl[q], k: pl[q + 1], s: pl[q + 2] };
    e.post = cols[e.pre][e.k].targets[e.s].target;
    inc[e.post].push(e); out[e.pre].push(e);
  }
  inc.forEach((l) => l.sort((a, b) => a.pre - b.pre || a.k - b.k));
  out.forEach((l) => l.sort((a, b) => a.post - b.post || a.k - b.k));

  const f32 = () => new Float32Array(N);
  const state = {
    S: f32(), Db: f32(), Da: f32(), G: f32(), ref: new Int32Array(N), noul: f32(),
    lastSpikeStep: new Int32Array(N).fill(-1), xPre: f32(), yPost: f32(),
    weights: cols.map((l) => l.map((c) => Float64Array.from(c.targets, (t) => t.w0))), // [src][k][synIdx]
  };
  const inB = new Float32Array(L * N), inA = new Float32Array(L * N), inS = new Float32Array(L * N), inSh = new Float32Array(L * N);
  const RING = [inB, inA, inS]; // by comp 0|1|2

  let curSeed = seed >>> 0;
  let p = { ...DEFAULTS, ...clampParams(params, { allowFixed: test }), seed: curSeed };
  let d = derive(p);
  let n = 0, rStim, rIn, rTd, rNoise, rSpike, rRoute;
  let img = new Float32Array(256), stimId = 'blank';
  const z = new Float32Array(256), pPix = new Float64Array(256);
  const forced = new Float64Array(N).fill(NaN); // debug.forceNoul; NaN = off
  const control = { betaOutput: 0, stdpM: 1 };
  const stats = { nanResets: 0, dampGain: 1, runawayActive: false };
  let spikeLog = [], routeLog = [], rasterH = FNV0, inputH = FNV0, eWin50 = 0, eWin500 = 0, hot = 0;

  function seedStreams() {
    const m = (s) => mulberry32(streamSeed(curSeed, s));
    rStim = m(STREAM.STIM); rIn = m(STREAM.INPUT); rTd = m(STREAM.TOPDOWN);
    rNoise = m(STREAM.NOISE); rSpike = m(STREAM.SPIKE); rRoute = m(STREAM.ROUTE);
  }
  function recomputeRates() {
    const r = rates(effectiveIntensity(img, p.contrast, p.pixelNoise, z), p.rBase, p.rMax);
    for (let q = 0; q < 256; q++) pPix[q] = (r[q] * d.dt) / 1000;
  }
  function deliver(src, syn, w) {
    const at = ((n + syn.dSteps) % L) * N + syn.target;
    if (isPV[src] && exc[syn.target]) {
      if (p.pvMode !== 'divisive') inS[at] += w;
      if (p.pvMode !== 'subtractive') inSh[at] += (0.3 * p.g) / 4;
    } else RING[syn.comp][at] += w;
  }
  function bump(e, f) {
    const wmax = 2 * cols[e.pre][e.k].targets[e.s].w0, W = state.weights[e.pre][e.k];
    W[e.s] = clamp(W[e.s] + f * wmax, 0, wmax);
  }

  function step() {
    const s = n % L, o = s * N, dt = d.dt;
    if (n % 100 === 0) { for (let q = 0; q < 256; q++) z[q] = gauss(rStim); recomputeRates(); } // FR-ENC-03
    // 1. input pixels, 2. top-down
    const sIn = ((n + d.dInputSteps) % L) * N;
    for (let q = 0; q < 256; q++) {
      if (rIn() < pPix[q]) {
        inputH = fnvU32(fnvU32(inputH, n), q);
        for (const i of L4E) { const K = network.kernels[i]; if (K) inB[sIn + i] += p.wIn * K[q]; }
        for (const i of L4PV) inS[sIn + i] += p.wFfPv;
      }
    }
    const pTd = (p.attention * p.rTopDownMax * dt) / 1000;
    for (const i of TD) if (rTd() < pTd) { if (exc[i]) inA[sIn + i] += 3; else inS[sIn + i] += 6; }
    // 3+4. read slot s, neuron update
    const { S, Db, Da, G, ref, noul } = state, { lamM, lamB, lamA, lamG } = d;
    const nsd = p.sigmaV * Math.sqrt(1 - lamM * lamM);
    for (let i = 0; i < N; i++) {
      let db = Db[i], da = Da[i], g = lamG * G[i] + inSh[o + i], sv;
      if (exc[i]) { db = lamB * db + inB[o + i]; da = lamA * da + inA[o + i]; }
      const xi = nsd * gauss(rNoise);
      const refr = ref[i] > 0;
      if (refr) { ref[i]--; sv = p.vReset; } else if (exc[i]) {
        const phi = da + p.caAmp * sig((da - p.caTheta) / p.caDelta);
        sv = lamM * S[i] + ((1 - lamM) * (p.aBasal * db + p.aApical * phi)) / (1 + g) + inS[o + i] + xi;
      } else sv = lamM * S[i] + inS[o + i] + xi;
      sv = clamp(sv, -20, 40); db = clamp(db, -20, 40); da = clamp(da, -20, 40); g = clamp(g, 0, 20);
      if (!(Number.isFinite(sv) && Number.isFinite(db) && Number.isFinite(da) && Number.isFinite(g))) {
        if (!Number.isFinite(sv)) sv = 0;
        if (!Number.isFinite(db)) db = 0;
        if (!Number.isFinite(da)) da = 0;
        if (!Number.isFinite(g)) g = 0;
        stats.nanResets++;
      }
      S[i] = sv; Db[i] = db; Da[i] = da; G[i] = g;
      noul[i] = refr ? 0 : Number.isNaN(forced[i]) ? sig((sv - p.theta) / p.delta) : forced[i];
    }
    // 5. spike sampling (one draw per neuron, always)
    const spk = [];
    for (let i = 0; i < N; i++) { const u = rSpike(); if (ref[i] === 0 && u < spikeHazard(noul[i], d.noulExp)) spk.push(i); }
    // 6. spike handling, ascending index
    const routes = [];
    for (const i of spk) {
      S[i] = p.vReset; ref[i] = d.refSteps; state.lastSpikeStep[i] = n;
      spikeLog.push(n, i); rasterH = fnvU32(fnvU32(rasterH, n), i);
      for (const syn of trunk[i]) deliver(i, syn, syn.inhibitory ? (syn.w0 * p.g) / 4 : syn.w0);
      if (!exc[i]) continue;
      eWin50++; eWin500++;
      const c = cols[i], K = c.length, a = new Float64Array(K), tc = Math.max(0.05, p.tauC);
      let mx = -Infinity, sum = 0;
      for (let k = 0; k < K; k++) {
        a[k] = c[k].b + c[k].gamma * (Da[i] / p.theta) + (isL23E[i] && c[k].id === 'output' ? control.betaOutput : 0);
        if (a[k] > mx) mx = a[k];
      }
      for (let k = 0; k < K; k++) { a[k] = Math.exp((a[k] - mx) / tc); sum += a[k]; }
      for (let k = 0; k < K; k++) a[k] /= sum;
      const u = rRoute(); // always drawn per spiking E cell
      if (!K) continue;
      let k = 0;
      for (let cum = 0; k < K - 1; k++) { cum += a[k]; if (cum >= u) break; }
      const W = state.weights[i], dg = stats.dampGain;
      for (let kk = 0; kk < K; kk++) {
        const f = p.routing === 'hard' ? (kk === k ? dg : 0) : dg * a[kk];
        if (f) c[kk].targets.forEach((syn, si) => deliver(i, syn, W[kk][si] * f));
      }
      const r = { src: i, k, p: Float32Array.from(a) };
      routes.push(r); routeLog.push({ n, ...r });
    }
    // 7. STDP (SPEC 2.8 order a->b->c)
    if (p.stdp) {
      const { xPre, yPost } = state, M = control.stdpM;
      for (let i = 0; i < N; i++) { xPre[i] *= d.lamPlus; yPost[i] *= d.lamMinus; }
      for (const j of spk) for (const e of inc[j]) bump(e, M * p.aPlus * xPre[e.pre]);
      for (const i of spk) for (const e of out[i]) bump(e, -M * p.aMinus * yPost[e.post]);
      for (const i of spk) { xPre[i] += 1; yPost[i] += 1; }
    }
    // 8. clear slot, advance; runaway guard (FR-SIM-12)
    for (const A of [inB, inA, inS, inSh]) A.fill(0, o, o + N);
    n++;
    if (nE && n % 100 === 0) {
      hot = eWin50 / nE / 0.05 > 150 ? hot + 1 : 0; eWin50 = 0;
      if (hot >= 3) { stats.dampGain = Math.max(0.4, stats.dampGain * 0.8); hot = 0; }
    }
    if (nE && n % 1000 === 0) {
      if (eWin500 / nE / 0.5 < 50) { const g = stats.dampGain + 0.05; stats.dampGain = g > 1 - 1e-9 ? 1 : g; }
      eWin500 = 0;
    }
    stats.runawayActive = stats.dampGain < 1;
    if (n % 2000 === 0) trimLogs();
    return { spikes: Int32Array.from(spk), routes };
  }

  function trimLogs() {
    const cut = n - RETAIN;
    let q = 0;
    while (q < spikeLog.length && spikeLog[q] < cut) q += 2;
    if (q) spikeLog = spikeLog.slice(q);
    if (routeLog.length && routeLog[0].n < cut) routeLog = routeLog.filter((r) => r.n >= cut);
  }

  function reset(newSeed) {
    if (newSeed !== undefined) curSeed = newSeed >>> 0;
    p.seed = curSeed;
    n = 0;
    for (const k of ['S', 'Db', 'Da', 'G', 'ref', 'noul', 'xPre', 'yPost']) state[k].fill(0);
    state.lastSpikeStep.fill(-1);
    cols.forEach((l, i) => l.forEach((c, k) => c.targets.forEach((t, s) => { state.weights[i][k][s] = t.w0; })));
    for (const A of [inB, inA, inS, inSh]) A.fill(0);
    spikeLog = []; routeLog = []; rasterH = FNV0; inputH = FNV0; eWin50 = 0; eWin500 = 0; hot = 0;
    Object.assign(stats, { nanResets: 0, dampGain: 1, runawayActive: false });
    z.fill(0);
    seedStreams(); recomputeRates();
  }
  reset();

  const sim = {
    step,
    stepN(k) { for (let q = 0; q < k; q++) step(); },
    setParams(partial) {
      const c = clampParams(partial, { allowFixed: test });
      delete c.seed; // topology is seed-built; seed change = caller rebuilds network + createSim (FR-DET-01); reset(seed) reseeds streams only
      p = { ...p, ...c }; d = derive(p); recomputeRates();
    },
    setStimulus(im, id) { img = Float32Array.from(im); stimId = id; recomputeRates(); },
    setControl(c) {
      if (c.betaOutput !== undefined) control.betaOutput = clamp(c.betaOutput, -0.5, 0.5);
      if (c.stdpM !== undefined) control.stdpM = clamp(c.stdpM, 0.5, 1.5);
    },
    reset,
    get t() { return n * d.dt; },
    get n() { return n; },
    get params() { return p; },
    get seed() { return curSeed; },
    get stimulusId() { return stimId; },
    state,
    stats,
    spikesSince(n0) {
      let q = spikeLog.length;
      while (q > 0 && spikeLog[q - 2] >= n0) q -= 2;
      return Int32Array.from(spikeLog.slice(q));
    },
    // Not in SPEC 5.2: E-spike routing log [{n, src, k, p}] for readout (T05) and Choice bars (SPEC 2.5).
    routesSince(n0) { return routeLog.filter((r) => r.n >= n0); },
    rasterHash() { return hex8(rasterH); },
    inputHash() { return hex8(inputH); },
  };
  if (test) {
    sim.debug = {
      inject(i, comp, mV, delaySteps = 0) { RING[comp][((n + delaySteps) % L) * N + i] += mV; },
      forceNoul(i, v) { forced[i] = v === null ? NaN : v; },
      setState(i, partial) { for (const k of ['S', 'Db', 'Da', 'G', 'ref']) if (k in partial) state[k][i] = partial[k]; },
    };
  }
  return sim;
}
