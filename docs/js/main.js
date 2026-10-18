// Module entry: wiring + rAF loop + window.__mc test hook (SPEC 4.4, 4.5, 5.5, 6, FR-TST-09).
import { DEFAULTS, DT, parseSeed } from './core/params.js';
import { makePreset, effectiveIntensity } from './core/stimuli.js';
import { rates } from './core/encoding.js';
import { mulberry32, streamSeed, STREAM } from './core/rng.js';
import { buildNetwork } from './core/network.js';
import { createSim } from './core/sim.js';
import { computeSteps } from './core/loop.js';
import { localReadout, agree } from './core/readout.js';
import { createScheduler } from './core/scheduler.js';
import { createJevClient } from './jev/client.js';
import { createKeystore } from './jev/keystore.js';
import { validateRecording } from './jev/replay.js';
import { neuronRequest } from './jev/schema.js';
import { summarizeNeuron } from './jev/summary.js';
import { createStore } from './ui/store.js';
import { createBus } from './ui/bus.js';
import { initTheme } from './ui/theme.js';
import { initBanner } from './ui/banner.js';
import { initHeader } from './ui/header.js';
import { initInputPanel } from './ui/input-panel.js';
import { initParamsPanel } from './ui/params-panel.js';
import { initCircuitView } from './ui/circuit-view.js';
import { initCharts } from './ui/charts.js';
import { initDashboard } from './ui/dashboard.js';
import { initJevLog } from './ui/jev-log.js';
import { initKeyModal } from './ui/key-modal.js';
import { initAbout } from './ui/about.js';
import { initKeyboard } from './ui/keyboard.js';

const CYCLE = ['vbar', 'hbar', 'diag45', 'diag135'];
const CYCLE_MS = 2000;
const POPS_GROUPED = ['L4E', 'L23E', 'L5E'];
const ZERO = new Float32Array(256);
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

// ---- URL params (FR-JEV-02, FR-KEY-08, FR-DET-04, FR-TST-09) ----
const url = new URL(location.href);
const q = url.searchParams;
const test = q.get('test') === '1';
const autoplay = q.get('autoplay') !== '0';
const wantMode = { replay: 'REPLAY', live: 'LIVE' }[q.get('mode')] || null;
const keyInUrl = ['key', 'apiKey', 'token'].filter((k) => q.has(k));
if (keyInUrl.length) {
  keyInUrl.forEach((k) => q.delete(k));
  try { history.replaceState(null, '', url); } catch { /* sandboxed */ }
}
const ps = q.has('seed') ? parseSeed(q.get('seed')) : null;
const seed0 = ps?.ok ? ps.seed : DEFAULTS.seed;

// ---- store, bus ----
const store = createStore({
  run: autoplay ? 'running' : 'idle', runId: 0, speed: 100, seed: seed0,
  params: { ...DEFAULTS, seed: seed0 }, stimulus: { id: 'vbar', img: makePreset('vbar', seed0) },
  mode: 'SIMULATED', availability: { replay: false, live: false, keySource: null }, keySource: null,
  selection: [], budget: { used: 0, cap: DEFAULTS.budget }, unrecorded: 0, banner: null,
  theme: 'system', reducedMotion: false, jevReadout: null, compare: null, cycle: false,
});
const bus = createBus();
const S = () => store.get();
const setRun = (run) => { if (S().run !== run) { store.set({ run }); bus.emit('run:changed', { run }); } };

// ---- JEV client + keystore ----
const lazy = (name) => ({ // storage access can throw (EC-22); keystore wraps calls in try/catch
  getItem: (k) => window[name].getItem(k), setItem: (k, v) => window[name].setItem(k, v), removeItem: (k) => window[name].removeItem(k),
});
const keystore = createKeystore({ session: lazy('sessionStorage'), local: lazy('localStorage') });
const client = createJevClient({ mode: 'SIMULATED', keystore, bus, getSeed: () => S().seed });
client.setBudgetCap(S().budget.cap);
client.liveMinIntervalMs = S().params.liveMinIntervalMs;

// ---- sim (rebuilt on every reset: FR-UI-18, seed change rebuilds topology) ----
let network, sim, scheduler, acc = 0, frameNo = 0;
let popCounts, groupCounts, uiRng;
function rebuild() {
  scheduler?.reset(); // aborts in-flight JEV (client.resetRun)
  const s = S();
  network = buildNetwork(s.params, s.seed);
  sim = createSim(network, s.params, s.seed);
  sim.setStimulus(s.stimulus.img, s.stimulus.id);
  scheduler = createScheduler({
    sim, network, client, getParams: () => S().params, getStimulusId: () => S().stimulus.id,
    getLocalLabel: () => readout().label, bus,
  });
  acc = 0;
  popCounts = Object.fromEntries(network.pops.map((p) => [p.id, 0]));
  groupCounts = Object.fromEntries(POPS_GROUPED.map((p) => [p, [0, 0, 0, 0]]));
  uiRng = mulberry32(streamSeed(s.seed, STREAM.UI));
  if (s.jevReadout || s.compare) store.set({ jevReadout: null, compare: null }); // FR-UI-18 clears readout
}
const readout = () => localReadout(sim.routesSince(sim.n - Math.round(200 / DT)), sim.n, network, 200, S().params.routing);

// Must be registered before circuit view / charts so they see the new network on `reset`.
bus.on('reset', rebuild);
rebuild();

// ---- UI modules ----
initTheme(store);
if (test) { document.documentElement.classList.add('test-mode'); store.set({ reducedMotion: true }); }
initBanner(store, bus);
initHeader(store, bus);
initInputPanel(store, bus);
initParamsPanel(store, bus);
const ctx = { getSim: () => sim, getNetwork: () => network };
const circuit = initCircuitView({ store, bus, ...ctx });
initCharts(store, bus, ctx);
initDashboard(store, bus, { ...ctx, readout, agree });
initJevLog(store, bus, ctx);
initKeyModal(store, bus, keystore);
initAbout(store, bus);
initKeyboard(store, bus);
if (keyInUrl.length) bus.emit('banner', { level: 'warn', text: 'Keys in URLs are ignored for your safety' });

// ---- store → sim / client sync ----
let lastStim = S().stimulus;
store.subscribe((s) => {
  if (s.stimulus !== lastStim) { lastStim = s.stimulus; sim.setStimulus(s.stimulus.img, s.stimulus.id); }
  if (s.budget.cap !== client.budget.cap) client.setBudgetCap(s.budget.cap);
});
bus.on('stimulus:changed', ({ id }) => scheduler.onStimulusChange(id, sim.t)); // FR-UI-17
bus.on('params:changed', ({ patch }) => {
  sim.setParams(patch); // FR-UI-16: live at next step
  client.liveMinIntervalMs = S().params.liveMinIntervalMs;
});
const syncBudget = () => {
  const b = client.budget;
  if (b.used !== S().budget.used || b.cap !== S().budget.cap) store.set({ budget: { used: b.used, cap: b.cap } });
};

// ---- JEV events ----
const panel = $('readout-panel');
const novel = document.createElement('span');
novel.className = 'novel-input'; novel.textContent = 'novel input'; novel.hidden = true;
panel.prepend(novel);
let novelTimer = null;
bus.on('jev:request', syncBudget);
bus.on('jev:response', ({ result }) => {
  syncBudget();
  if (result.status === 'unrecorded') store.set({ unrecorded: S().unrecorded + 1 });
  const b = client.budget;
  if (result.mode === 'LIVE' && b.used >= b.cap && S().params.autoJev) { // FR-JEV-13: used == cap → autoJev off
    store.set({ params: { ...S().params, autoJev: false } });
    bus.emit('params:changed', { patch: { autoJev: false } });
  }
  const nu = result.response?.answers?.circuit_novelty?.noul; // FR-JEV-17 flash
  if (S().params.jevControl && nu > 0.7) {
    novel.hidden = false;
    clearTimeout(novelTimer);
    novelTimer = setTimeout(() => { novel.hidden = true; }, 1000);
  }
});
bus.on('jev:response', ({ result }) => { // §3.7 UI behaviour per client code
  const code = result.error?.code;
  if ((code === 'unauthorized' && S().keySource === 'none') || (code === 'no_key' && S().availability.live)) bus.emit('key:open', {}); // EC-02
  if (code === 'proxy_unreachable') client.health().then(applyHealth); // LIVE disabled until health passes
});
bus.on('jev:error', syncBudget); // aborted
bus.on('jev:ask', ({ ids }) => {
  const id = ids?.[0];
  if (!id || client.inFlight) return;
  client.ask('neuron', neuronRequest(summarizeNeuron(sim, network, id)), sim.t);
});

// ---- mode switching (FR-JEV-05, FR-UI-19, state no-key) ----
let curMode = 'SIMULATED', modeSel = 0;
const commitMode = (mode) => {
  curMode = mode;
  client.setMode(mode); // aborts in-flight when leaving LIVE
  store.set({ mode, runId: S().runId + 1 });
};
const applyHealth = (h) => {
  const keySource = h ? h.keySource : null;
  store.set({ keySource, availability: { ...S().availability, live: !!h, keySource } });
  if (h && !keystore.enabled) keystore.enable(); // FR-KEY-11
};
async function selectMode(mode) {
  const tok = ++modeSel;
  if (mode !== 'LIVE') { commitMode(mode); return; }
  if (curMode === 'LIVE') { store.set({ mode: 'LIVE' }); return; }
  store.set({ mode: curMode }); // stay on previous until health passes
  client.setMode('LIVE'); // before health() (client selection token)
  const h = await client.health();
  if (tok !== modeSel) return;
  applyHealth(h);
  if (h && (h.keySource !== 'none' || keystore.has())) { commitMode('LIVE'); return; }
  client.setMode(curMode);
  if (h) bus.emit('key:open', {}); // no-key state
}
bus.on('mode:changed', ({ mode }) => { if (mode !== curMode || client.mode !== mode) selectMode(mode); });

// ---- frame building + stepping (same path for loop, Step, __mc.runSteps) ----
function newFrame() { return { stepsRun: 0, spikes: [], routes: [], pixelSpikes: new Uint8Array(256), capped: false }; }
function stepOnce(f) {
  const r = sim.step();
  scheduler.afterStep(sim.n - 1);
  for (const i of r.spikes) {
    f.spikes.push(i);
    const nr = network.neurons[i];
    popCounts[nr.pop]++;
    if (groupCounts[nr.pop] && nr.o >= 0) groupCounts[nr.pop][nr.o]++;
  }
  for (const x of r.routes) f.routes.push(x);
  f.stepsRun++;
  if (S().cycle && sim.t % CYCLE_MS === 0) { // rotate presets every 2000 ms sim
    const id = CYCLE[(CYCLE.indexOf(S().stimulus.id) + 1) % CYCLE.length];
    store.set({ stimulus: { id, img: makePreset(id, S().seed) } });
    bus.emit('stimulus:changed', { id });
  }
}
// Input-grid flash is visual only: Bernoulli at the pixel rates from the UI stream (sim streams untouched).
function pixelFlash(f) {
  if (!f.stepsRun) return;
  const s = S(), p = s.params;
  const r = rates(effectiveIntensity(s.stimulus.img, p.contrast, 0, ZERO), p.rBase, p.rMax);
  for (let i = 0; i < 256; i++) f.pixelSpikes[i] = uiRng() < 1 - Math.pow(1 - (r[i] * DT) / 1000, f.stepsRun) ? 1 : 0;
}
function renderFrame(f, force = false) {
  if (!f.stepsRun && !force) return;
  pixelFlash(f);
  f.spikes = Int32Array.from(f.spikes);
  bus.emit('frame', f);
  circuit.render(f);
  $('sim-time').textContent = `t = ${sim.t.toFixed(1)} ms`;
}
function runSteps(n) {
  const f = newFrame();
  for (let k = 0; k < n; k++) stepOnce(f);
  renderFrame(f, true);
}
bus.on('step', () => runSteps(10)); // btn-step: 5 ms sim
bus.on('reset', () => renderFrame(newFrame(), true)); // after circuit view/charts swapped network

// ---- rAF loop: exactly one, started once (EC-19) ----
let lastWall = null;
function loop(now) {
  frameNo++;
  const dt = lastWall === null ? 0 : now - lastWall;
  lastWall = now;
  if (S().run === 'running') {
    const c = computeSteps(acc, dt, S().speed);
    acc = c.acc;
    const f = newFrame();
    f.capped = c.capped;
    for (let k = 0; k < c.steps; k++) stepOnce(f);
    renderFrame(f);
  } else acc = 0;
  requestAnimationFrame(loop);
}
bus.on('run:changed', () => { acc = 0; });

// ---- tab visibility (NFR-PERF-05, EC-17) ----
let resumeOnVisible = false;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    resumeOnVisible = S().run === 'running';
    if (resumeOnVisible) setRun('paused');
  } else if (resumeOnVisible) { resumeOnVisible = false; acc = 0; lastWall = null; setRun('running'); }
});

// ---- test hook (FR-TST-09): never exposes the key ----
function getState() {
  const s = S();
  return {
    t: sim.t, n: sim.n, run: s.run === 'running', mode: s.mode, frame: frameNo,
    spikeCountsByPop: { ...popCounts },
    spikeCountsByGroup: Object.fromEntries(POPS_GROUPED.map((p) => [p, [...groupCounts[p]]])),
    readoutLocal: readout().label, readoutJev: s.jevReadout ? { ...s.jevReadout } : null,
    jevLogLength: document.querySelectorAll('[data-testid="jev-log-entry"]').length,
    budget: { ...s.budget }, selection: [...s.selection], rasterHash: sim.rasterHash(), unrecorded: s.unrecorded,
  };
}
if (test) {
  window.__mc = {
    pause: () => setRun('paused'),
    runSteps(n) { setRun('paused'); runSteps(n | 0); return getState(); },
    setSeed(v) { $('seed-input').value = String(v); $('btn-seed-apply').click(); },
    getState,
  };
}

// ---- boot: render t=0, start loop, probe health + recording (FR-JEV-05/06) ----
renderFrame(newFrame(), true);
requestAnimationFrame(loop);

const healthP = client.health().then((h) => { if (modeSel === 0) applyHealth(h); return h; });
const replayP = fetch('data/jev-recording.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    const v = j && validateRecording(j);
    if (!v?.ok || !v.recording.entries?.length) return false;
    client.setReplay(v.recording);
    store.set({ availability: { ...S().availability, replay: true } });
    return true;
  })
  .catch(() => false);
if (wantMode) {
  Promise.all([healthP, replayP]).then(([h, rep]) => {
    if (wantMode === 'REPLAY' ? rep : !!h) selectMode(wantMode);
    else bus.emit('banner', { level: 'info', text: `${wantMode} mode is not available here; staying in SIMULATED mode` });
  });
}
